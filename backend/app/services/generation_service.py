"""Generation Run orchestration and review lifecycle helpers."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.analysis import Analysis
from app.models.document import (
    Document,
    DocumentSetupStage,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)
from app.models.generation import (
    FailoverState,
    GenerationMode,
    GenerationRun,
    GenerationRunStatus,
    GenerationSectionTask,
    GenerationTaskStatus,
)
from app.services import ai_credential_service
from app.services.ai_doc_service import ai_service
from app.services.template_recommendation_service import get_current_analysis


PROVIDER_PARALLELISM = {
    "anthropic": 2,
    "google": 3,
    "openai": 2,
    "opencode-go": 2,
}

MODEL_PRICING_PER_1K = {
    "anthropic": {
        "claude-sonnet-4-20250514": {"prompt": 0.003, "completion": 0.015},
        "claude-3-5-sonnet-20241022": {"prompt": 0.003, "completion": 0.015},
    },
    "google": {
        "gemini-3.1-flash-lite": {"prompt": 0.00025, "completion": 0.0015},
        "gemini-3.5-flash": {"prompt": 0.0015, "completion": 0.009},
        "gemini-3.1-pro-preview": {"prompt": 0.002, "completion": 0.012},
    },
    "opencode-go": {
        "deepseek-v4-flash": {"prompt": 0.00014, "completion": 0.00028},
        "deepseek-v4-pro": {"prompt": 0.00174, "completion": 0.00348},
        "kimi-k2.6": {"prompt": 0.00095, "completion": 0.004},
        "kimi-k2.5": {"prompt": 0.0006, "completion": 0.003},
        "glm-5.1": {"prompt": 0.0014, "completion": 0.0044},
        "glm-5": {"prompt": 0.001, "completion": 0.0032},
        "mimo-v2.5": {"prompt": 0.00014, "completion": 0.00028},
        "mimo-v2.5-pro": {"prompt": 0.00174, "completion": 0.00348},
    },
}

FAILOVER_ERROR_CATEGORIES = {"quota", "sustained_rate_limit", "outage"}


@dataclass
class GeneratedSection:
    content_md: str
    confidence_score: int
    prompt_tokens: int
    completion_tokens: int
    cost: float
    provider: str
    model: str


class ProviderGenerationError(Exception):
    def __init__(self, message: str, category: str):
        super().__init__(message)
        self.category = category


def _token_estimate(text: str) -> int:
    return max(1, round(len(text) / 4))


def _cost(provider: str | None, model: str | None, prompt_tokens: int, completion_tokens: int) -> float:
    pricing = MODEL_PRICING_PER_1K.get(provider or "", {}).get(model or "")
    if not pricing:
        return 0.0
    return round(
        (prompt_tokens / 1000 * pricing["prompt"])
        + (completion_tokens / 1000 * pricing["completion"]),
        6,
    )


def _relative_usage(total_prompt: int, total_completion: int) -> str:
    total = total_prompt + total_completion
    if total < 5000:
        return "low"
    if total < 15000:
        return "medium"
    return "high"


async def _active_sections(db: AsyncSession, document_id: int) -> list[Section]:
    result = await db.execute(
        select(Section)
        .where(
            Section.document_id == document_id,
            Section.lifecycle_status == LifecycleStatus.ACTIVE,
        )
        .order_by(Section.order_index.asc(), Section.id.asc())
    )
    return list(result.scalars().all())


def _section_dependency_ids(sections: list[Section]) -> dict[int, list[int]]:
    by_id = {section.id: section for section in sections}
    by_heading = {section.heading.lower(): section.id for section in sections}
    dependencies: dict[int, list[int]] = {}

    for section in sections:
        raw_metadata = section.workflow_metadata or {}
        raw_dependencies = (
            raw_metadata.get("depends_on_section_ids")
            or raw_metadata.get("dependency_section_ids")
            or raw_metadata.get("depends_on")
            or []
        )
        if not isinstance(raw_dependencies, list):
            raw_dependencies = [raw_dependencies]

        resolved: list[int] = []
        if section.parent_id in by_id:
            resolved.append(section.parent_id)
        for item in raw_dependencies:
            if isinstance(item, int) and item in by_id:
                resolved.append(item)
            elif isinstance(item, str):
                maybe_id = by_heading.get(item.lower())
                if maybe_id:
                    resolved.append(maybe_id)

        dependencies[section.id] = sorted(set(dep for dep in resolved if dep != section.id))
    return dependencies


async def estimate_usage(
    db: AsyncSession,
    document: Document,
    *,
    mode: GenerationMode,
    section_ids: list[int] | None,
    provider: str | None,
    model: str | None,
) -> dict[str, Any]:
    sections = await _sections_for_mode(db, document, mode, section_ids)
    analysis = await get_current_analysis(db, document.project_id)
    analysis_weight = _token_estimate(str(_analysis_snapshot(analysis)))
    section_breakdown = []
    total_prompt = 0
    total_completion = 0

    for section in sections:
        metadata = section.workflow_metadata or {}
        context_tokens = 500 + analysis_weight + _token_estimate(str(metadata))
        completion_tokens = 700 + _token_estimate(section.heading) * 12
        total_prompt += context_tokens
        total_completion += completion_tokens
        section_breakdown.append(
            {
                "section_id": section.id,
                "heading": section.heading,
                "estimated_prompt_tokens": context_tokens,
                "estimated_completion_tokens": completion_tokens,
                "estimated_cost": _cost(provider, model, context_tokens, completion_tokens),
                "uncertainty": "medium",
            }
        )

    return {
        "mode": mode.value,
        "provider": provider,
        "model": model,
        "relative_usage": _relative_usage(total_prompt, total_completion),
        "estimated_prompt_tokens": total_prompt,
        "estimated_completion_tokens": total_completion,
        "estimated_cost": _cost(provider, model, total_prompt, total_completion),
        "uncertainty": "medium",
        "section_breakdown": section_breakdown,
        "pricing_note": "Approximate provider cost estimate, not authoritative billing.",
    }


async def _sections_for_mode(
    db: AsyncSession,
    document: Document,
    mode: GenerationMode,
    section_ids: list[int] | None,
) -> list[Section]:
    sections = await _active_sections(db, document.id)
    if mode == GenerationMode.SECTION_ON_DEMAND:
        if not section_ids:
            raise HTTPException(status_code=400, detail="section_ids required for on-demand generation")
        wanted = set(section_ids)
        sections = [section for section in sections if section.id in wanted]
        if len(sections) != len(wanted):
            raise HTTPException(status_code=404, detail="One or more Sections were not found")
    return sections


async def create_generation_run(
    db: AsyncSession,
    document: Document,
    *,
    user_id: int,
    mode: GenerationMode,
    section_ids: list[int] | None = None,
) -> GenerationRun:
    active = await ai_credential_service.get_active_credential(db, user_id)
    if active is None:
        raise HTTPException(status_code=400, detail="Active provider credential required for generation.")

    sections = await _sections_for_mode(db, document, mode, section_ids)
    if not sections:
        raise HTTPException(status_code=400, detail="No active Sections are available for generation")

    estimate = await estimate_usage(
        db,
        document,
        mode=mode,
        section_ids=[section.id for section in sections],
        provider=active.provider,
        model=active.model_id,
    )
    run = GenerationRun(
        document_id=document.id,
        mode=mode,
        intended_provider=active.provider,
        intended_model=active.model_id,
        status=GenerationRunStatus.PENDING,
        failover_state=FailoverState.NOT_REQUIRED,
        estimated_prompt_tokens=estimate["estimated_prompt_tokens"],
        estimated_completion_tokens=estimate["estimated_completion_tokens"],
        estimated_cost=estimate["estimated_cost"],
        run_metadata={
            "estimate": estimate,
            "relative_usage": estimate["relative_usage"],
            "uncertainty": estimate["uncertainty"],
        },
    )
    db.add(run)
    await db.flush()

    dependencies = _section_dependency_ids(sections)
    for section in sections:
        db.add(
            GenerationSectionTask(
                generation_run_id=run.id,
                section_id=section.id,
                status=GenerationTaskStatus.QUEUED,
                dependency_section_ids=dependencies.get(section.id, []),
                task_metadata={
                    "estimate": next(
                        item
                        for item in estimate["section_breakdown"]
                        if item["section_id"] == section.id
                    )
                },
            )
        )
    document.setup_stage = DocumentSetupStage.EDITOR_READY
    document.updated_at = datetime.utcnow()
    await db.commit()
    return await get_generation_run(db, document.id, run.id)


async def execute_generation_run(
    db: AsyncSession,
    run: GenerationRun,
    *,
    user_id: int,
    override_provider: str | None = None,
    override_model: str | None = None,
) -> GenerationRun:
    provider = override_provider or run.intended_provider
    model = override_model or run.intended_model
    run.status = GenerationRunStatus.RUNNING
    run.started_at = run.started_at or datetime.utcnow()
    await db.commit()

    if run.mode == GenerationMode.COMPLETE_DOCUMENT:
        await _execute_complete_document(db, run, user_id=user_id, provider=provider, model=model)
    else:
        for task in sorted(run.section_tasks, key=lambda item: item.id):
            if task.status in {GenerationTaskStatus.QUEUED, GenerationTaskStatus.PAUSED}:
                await _execute_task(db, run, task, user_id=user_id, provider=provider, model=model)

    await _finalize_run_status(db, run)
    return await get_generation_run(db, run.document_id, run.id)


async def _execute_complete_document(
    db: AsyncSession,
    run: GenerationRun,
    *,
    user_id: int,
    provider: str | None,
    model: str | None,
) -> None:
    limit = PROVIDER_PARALLELISM.get(provider or "", 1)
    semaphore = asyncio.Semaphore(limit)

    while True:
        await db.refresh(run, attribute_names=["section_tasks"])
        task_by_section = {task.section_id: task for task in run.section_tasks}
        runnable = [
            task
            for task in run.section_tasks
            if task.status == GenerationTaskStatus.QUEUED
            and all(
                task_by_section.get(dep_id) is None
                or task_by_section[dep_id].status == GenerationTaskStatus.READY
                for dep_id in (task.dependency_section_ids or [])
            )
        ]
        blocked = [
            task
            for task in run.section_tasks
            if task.status == GenerationTaskStatus.QUEUED
            and any(
                task_by_section.get(dep_id) is not None
                and task_by_section[dep_id].status == GenerationTaskStatus.FAILED
                for dep_id in (task.dependency_section_ids or [])
            )
        ]
        for task in blocked:
            task.status = GenerationTaskStatus.PAUSED
            task.error_message = "Paused because a foundational Section task failed."
            task.updated_at = datetime.utcnow()
        if blocked:
            await db.commit()

        if not runnable:
            return

        for task in runnable[:limit]:
            async with semaphore:
                await _execute_task(db, run, task, user_id=user_id, provider=provider, model=model)
        if run.status == GenerationRunStatus.PAUSED:
            return


async def _execute_task(
    db: AsyncSession,
    run: GenerationRun,
    task: GenerationSectionTask,
    *,
    user_id: int,
    provider: str | None,
    model: str | None,
) -> None:
    section = await db.get(Section, task.section_id)
    if section is None:
        task.status = GenerationTaskStatus.FAILED
        task.error_message = "Section not found."
        await db.commit()
        return

    now = datetime.utcnow()
    task.status = GenerationTaskStatus.GENERATING
    task.actual_provider = provider
    task.actual_model = model
    task.started_at = task.started_at or now
    task.updated_at = now
    section.is_generating = True
    section.has_failed = False
    await db.commit()

    try:
        result = await _generate_section_content(
            db,
            run,
            section,
            user_id=user_id,
            provider=provider,
            model=model,
        )
    except ProviderGenerationError as exc:
        section.is_generating = False
        if exc.category in FAILOVER_ERROR_CATEGORIES:
            task.status = GenerationTaskStatus.PAUSED
            run.status = GenerationRunStatus.PAUSED
            run.failover_state = FailoverState.NEEDS_CONFIRMATION
            run.error_message = str(exc)
        else:
            task.status = GenerationTaskStatus.FAILED
            section.has_failed = True
        task.error_message = str(exc)
        task.updated_at = datetime.utcnow()
        await db.commit()
        return
    except Exception as exc:  # deterministic generation/request failures stay task-local.
        section.is_generating = False
        section.has_failed = True
        task.status = GenerationTaskStatus.FAILED
        task.error_message = str(exc)
        task.updated_at = datetime.utcnow()
        await db.commit()
        return

    section.content_md = result.content_md
    section.confidence_score = result.confidence_score
    section.content_lifecycle = SectionContentLifecycle.GENERATED_DRAFT
    section.status = SectionStatus.DRAFT
    section.is_generating = False
    section.has_failed = False
    section.updated_at = datetime.utcnow()
    task.status = GenerationTaskStatus.READY
    task.prompt_tokens = result.prompt_tokens
    task.completion_tokens = result.completion_tokens
    task.cost = result.cost
    task.actual_provider = result.provider
    task.actual_model = result.model
    task.completed_at = datetime.utcnow()
    task.updated_at = task.completed_at
    await db.commit()


async def _generate_section_content(
    db: AsyncSession,
    run: GenerationRun,
    section: Section,
    *,
    user_id: int,
    provider: str | None,
    model: str | None,
) -> GeneratedSection:
    if provider not in PROVIDER_PARALLELISM:
        raise ProviderGenerationError(
            f"Provider '{provider}' is not supported for prose generation yet.",
            "request",
        )
    document = await db.get(Document, section.document_id)
    if document is None:
        raise ProviderGenerationError("Document not found for Section.", "request")
    content, confidence = await ai_service.generate_section(
        document.project_id,
        section.id,
        db,
        user_id,
    )
    prompt_tokens = _token_estimate(section.heading + str(section.workflow_metadata or {})) + 500
    completion_tokens = _token_estimate(content)
    return GeneratedSection(
        content_md=content,
        confidence_score=confidence,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost=_cost(provider, model, prompt_tokens, completion_tokens),
        provider=provider or "",
        model=model or "",
    )


async def _finalize_run_status(db: AsyncSession, run: GenerationRun) -> None:
    await db.refresh(run, attribute_names=["section_tasks"])
    if run.status == GenerationRunStatus.PAUSED:
        await _record_actual_usage(db, run)
        return
    statuses = {task.status for task in run.section_tasks}
    if GenerationTaskStatus.QUEUED in statuses or GenerationTaskStatus.GENERATING in statuses:
        run.status = GenerationRunStatus.RUNNING
    elif statuses and all(status == GenerationTaskStatus.READY for status in statuses):
        run.status = GenerationRunStatus.COMPLETED
        run.completed_at = datetime.utcnow()
    elif GenerationTaskStatus.FAILED in statuses:
        run.status = GenerationRunStatus.FAILED
        run.completed_at = datetime.utcnow()
    elif GenerationTaskStatus.PAUSED in statuses:
        run.status = GenerationRunStatus.PAUSED
    await _record_actual_usage(db, run)


async def _record_actual_usage(db: AsyncSession, run: GenerationRun) -> None:
    prompt = sum(task.prompt_tokens or 0 for task in run.section_tasks)
    completion = sum(task.completion_tokens or 0 for task in run.section_tasks)
    cost = sum(task.cost or 0 for task in run.section_tasks)
    run.actual_prompt_tokens = prompt
    run.actual_completion_tokens = completion
    run.actual_cost = round(cost, 6)
    run.updated_at = datetime.utcnow()
    await db.commit()


async def get_generation_run(db: AsyncSession, document_id: int, run_id: int) -> GenerationRun:
    result = await db.execute(
        select(GenerationRun)
        .where(GenerationRun.id == run_id, GenerationRun.document_id == document_id)
        .options(selectinload(GenerationRun.section_tasks))
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Generation Run not found")
    return run


async def list_generation_runs(db: AsyncSession, document_id: int) -> list[GenerationRun]:
    result = await db.execute(
        select(GenerationRun)
        .where(GenerationRun.document_id == document_id)
        .options(selectinload(GenerationRun.section_tasks))
        .order_by(GenerationRun.created_at.desc(), GenerationRun.id.desc())
    )
    return list(result.scalars().all())


async def confirm_failover(
    db: AsyncSession,
    run: GenerationRun,
    *,
    user_id: int,
    provider: str,
    model: str,
) -> GenerationRun:
    if run.failover_state != FailoverState.NEEDS_CONFIRMATION:
        raise HTTPException(status_code=409, detail="Generation Run does not require failover confirmation")
    run.failover_state = FailoverState.CONFIRMED
    run.status = GenerationRunStatus.RUNNING
    run.run_metadata = {
        **(run.run_metadata or {}),
        "confirmed_failover": {
            "provider": provider,
            "model": model,
            "confirmed_by": user_id,
            "confirmed_at": datetime.utcnow().isoformat(),
        },
    }
    for task in run.section_tasks:
        if task.status == GenerationTaskStatus.PAUSED and not task.prompt_tokens:
            task.status = GenerationTaskStatus.QUEUED
    await db.commit()
    return await execute_generation_run(
        db,
        run,
        user_id=user_id,
        override_provider=provider,
        override_model=model,
    )


async def accept_section_review(
    db: AsyncSession,
    section: Section,
    *,
    user_id: int,
) -> Section:
    document = await db.get(Document, section.document_id)
    analysis = await get_current_analysis(db, document.project_id) if document else None
    now = datetime.utcnow()
    previous_lifecycle = section.content_lifecycle.value
    section.content_lifecycle = SectionContentLifecycle.REVIEWED
    section.status = SectionStatus.FINALIZED
    section.reviewed_by = user_id
    section.reviewed_at = now
    section.reviewed_against_analysis_id = analysis.id if analysis else None
    section.workflow_metadata = {
        **(section.workflow_metadata or {}),
        "review": {
            "reviewed_by": user_id,
            "reviewed_at": now.isoformat(),
            "analysis_snapshot": _analysis_snapshot(analysis),
            "content_lifecycle_before_review": previous_lifecycle,
        },
    }
    section.updated_at = now
    await db.commit()
    await db.refresh(section)
    return section


def _analysis_snapshot(analysis: Analysis | None) -> dict[str, Any] | None:
    if analysis is None:
        return None
    return {
        "analysis_id": analysis.id,
        "source_commit": analysis.source_commit,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        "languages": analysis.languages_json,
        "endpoints": analysis.endpoints_json,
        "file_tree": analysis.file_tree_json,
        "complexity": analysis.complexity_json,
    }

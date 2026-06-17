from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_work import (
    AIProposedChange,
    AIProposedChangeStatus,
    AIProposedChangeType,
    AIWorkRun,
    AIWorkRunStatus,
)
from app.models.document import (
    Document,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)
from app.models.version import AuthorType
from app.schemas.ai_work import AIProposedChangeCreate, AIWorkRunCreateRequest
from app.services.version_service import create_version_snapshot


def change_to_response(change: AIProposedChange) -> dict[str, Any]:
    return {
        "id": change.id,
        "work_run_id": change.work_run_id,
        "document_id": change.document_id,
        "section_id": change.section_id,
        "change_type": change.change_type.value,
        "status": change.status.value,
        "title": change.title,
        "rationale": change.rationale,
        "before": change.before_json,
        "after": change.after_json,
        "preview_markdown": change.preview_markdown,
        "accepted_by": change.accepted_by,
        "accepted_at": change.accepted_at,
        "rejected_by": change.rejected_by,
        "rejected_at": change.rejected_at,
        "undone_at": change.undone_at,
        "created_at": change.created_at,
    }


def run_to_response(run: AIWorkRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "document_id": run.document_id,
        "provider": run.provider,
        "model": run.model,
        "prompt_context": run.prompt_context or {},
        "status": run.status.value,
        "estimated_prompt_tokens": run.estimated_prompt_tokens,
        "estimated_completion_tokens": run.estimated_completion_tokens,
        "estimated_cost": run.estimated_cost,
        "actual_prompt_tokens": run.actual_prompt_tokens,
        "actual_completion_tokens": run.actual_completion_tokens,
        "actual_cost": run.actual_cost,
        "undo_group": run.undo_group,
        "error_message": run.error_message,
        "created_by": run.created_by,
        "proposed_changes": [
            change_to_response(change)
            for change in sorted(run.proposed_changes, key=lambda item: item.id)
        ],
        "created_at": run.created_at,
        "updated_at": run.updated_at,
        "completed_at": run.completed_at,
    }


async def _load_run(db: AsyncSession, document_id: int, run_id: int) -> AIWorkRun:
    result = await db.execute(
        select(AIWorkRun)
        .where(AIWorkRun.id == run_id, AIWorkRun.document_id == document_id)
        .options(selectinload(AIWorkRun.proposed_changes))
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="AI Work Run not found")
    return run


async def get_change(db: AsyncSession, document_id: int, change_id: int) -> AIProposedChange:
    result = await db.execute(
        select(AIProposedChange).where(
            AIProposedChange.id == change_id,
            AIProposedChange.document_id == document_id,
        )
    )
    change = result.scalar_one_or_none()
    if change is None:
        raise HTTPException(status_code=404, detail="AI Proposed Change not found")
    return change


async def create_work_run(
    db: AsyncSession,
    document: Document,
    body: AIWorkRunCreateRequest,
    user_id: int,
) -> AIWorkRun:
    status = AIWorkRunStatus.PROPOSED if body.changes else AIWorkRunStatus.PENDING
    run = AIWorkRun(
        document_id=document.id,
        provider=body.provider,
        model=body.model,
        prompt_context=body.prompt_context,
        status=status,
        estimated_prompt_tokens=body.estimated_prompt_tokens,
        estimated_completion_tokens=body.estimated_completion_tokens,
        estimated_cost=body.estimated_cost,
        created_by=user_id,
    )
    db.add(run)
    await db.flush()
    for item in body.changes:
        db.add(_new_change(run, document, item))
    await db.commit()
    return await _load_run(db, document.id, run.id)


def _new_change(
    run: AIWorkRun,
    document: Document,
    item: AIProposedChangeCreate,
) -> AIProposedChange:
    return AIProposedChange(
        work_run_id=run.id,
        document_id=document.id,
        section_id=item.section_id,
        change_type=AIProposedChangeType(item.change_type.value),
        status=AIProposedChangeStatus.PROPOSED,
        title=item.title,
        rationale=item.rationale,
        before_json=item.before,
        after_json=item.after,
        preview_markdown=item.preview_markdown,
    )


async def list_work_runs(db: AsyncSession, document_id: int) -> list[AIWorkRun]:
    result = await db.execute(
        select(AIWorkRun)
        .where(AIWorkRun.document_id == document_id)
        .options(selectinload(AIWorkRun.proposed_changes))
        .order_by(AIWorkRun.created_at.desc(), AIWorkRun.id.desc())
    )
    return list(result.scalars().all())


async def list_changes(db: AsyncSession, document_id: int) -> list[AIProposedChange]:
    result = await db.execute(
        select(AIProposedChange)
        .where(AIProposedChange.document_id == document_id)
        .order_by(AIProposedChange.created_at.desc(), AIProposedChange.id.desc())
    )
    return list(result.scalars().all())


def preview_change(change: AIProposedChange) -> dict[str, Any]:
    return {
        "change_type": change.change_type.value,
        "title": change.title,
        "rationale": change.rationale,
        "section_id": change.section_id,
        "before": change.before_json or {},
        "after": change.after_json or {},
        "preview_markdown": change.preview_markdown,
    }


async def accept_change(
    db: AsyncSession,
    document: Document,
    change: AIProposedChange,
    user_id: int,
) -> AIProposedChange:
    if change.status != AIProposedChangeStatus.PROPOSED:
        raise HTTPException(status_code=409, detail="Only proposed AI changes can be accepted")
    before = await _apply_change(db, document, change)
    change.before_json = before
    change.status = AIProposedChangeStatus.ACCEPTED
    change.accepted_by = user_id
    change.accepted_at = datetime.utcnow()
    run = await _load_run(db, document.id, change.work_run_id)
    accepted = sum(
        1
        for item in run.proposed_changes
        if item.status == AIProposedChangeStatus.ACCEPTED or item.id == change.id
    )
    proposed = sum(
        1
        for item in run.proposed_changes
        if item.status == AIProposedChangeStatus.PROPOSED and item.id != change.id
    )
    run.status = AIWorkRunStatus.ACCEPTED if proposed == 0 else AIWorkRunStatus.PARTIALLY_ACCEPTED
    undo_items = list((run.undo_group or {}).get("changes", []))
    run.undo_group = {"changes": [*undo_items, {"change_id": change.id, "before": before}]}
    if accepted == len(run.proposed_changes):
        run.completed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(change)
    return change


async def reject_change(
    db: AsyncSession,
    document: Document,
    change: AIProposedChange,
    user_id: int,
) -> AIProposedChange:
    if change.status != AIProposedChangeStatus.PROPOSED:
        raise HTTPException(status_code=409, detail="Only proposed AI changes can be rejected")
    change.status = AIProposedChangeStatus.REJECTED
    change.rejected_by = user_id
    change.rejected_at = datetime.utcnow()
    run = await _load_run(db, document.id, change.work_run_id)
    if all(item.status == AIProposedChangeStatus.REJECTED for item in run.proposed_changes):
        run.status = AIWorkRunStatus.REJECTED
        run.completed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(change)
    return change


async def undo_work_run(
    db: AsyncSession,
    document: Document,
    run_id: int,
) -> AIWorkRun:
    run = await _load_run(db, document.id, run_id)
    accepted_changes = [
        change
        for change in sorted(run.proposed_changes, key=lambda item: item.id, reverse=True)
        if change.status == AIProposedChangeStatus.ACCEPTED
    ]
    if not accepted_changes:
        raise HTTPException(status_code=409, detail="No accepted AI changes to undo")
    for change in accepted_changes:
        await _undo_change(db, change)
        change.status = AIProposedChangeStatus.UNDONE
        change.undone_at = datetime.utcnow()
    run.status = AIWorkRunStatus.UNDONE
    run.completed_at = datetime.utcnow()
    await db.commit()
    return await _load_run(db, document.id, run.id)


async def _section_for_change(db: AsyncSession, document_id: int, section_id: int | None) -> Section:
    if section_id is None:
        raise HTTPException(status_code=400, detail="AI change requires a section_id")
    result = await db.execute(
        select(Section).where(
            Section.id == section_id,
            Section.document_id == document_id,
            Section.lifecycle_status == LifecycleStatus.ACTIVE,
        )
    )
    section = result.scalar_one_or_none()
    if section is None:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


async def _apply_change(
    db: AsyncSession,
    document: Document,
    change: AIProposedChange,
) -> dict[str, Any]:
    after = change.after_json or {}
    if change.change_type in {
        AIProposedChangeType.GENERATE_SECTION,
        AIProposedChangeType.REWRITE_SELECTION,
    }:
        section = await _section_for_change(db, document.id, change.section_id)
        before = {"section_id": section.id, "content_md": section.content_md or ""}
        new_content = str(after.get("content_md") or after.get("content") or "")
        section.content_md = new_content
        section.content_lifecycle = SectionContentLifecycle.GENERATED_DRAFT
        section.status = SectionStatus.DRAFT
        section.updated_at = datetime.utcnow()
        await create_version_snapshot(
            db,
            section_id=section.id,
            old_content=before["content_md"],
            new_content=new_content,
            author_type=AuthorType.AI,
            summary=change.title,
        )
        return before

    if change.change_type == AIProposedChangeType.RENAME_SECTION:
        section = await _section_for_change(db, document.id, change.section_id)
        before = {"section_id": section.id, "heading": section.heading, "title": section.title}
        heading = str(after.get("heading") or after.get("title") or section.heading)
        section.heading = heading
        section.title = heading
        section.updated_at = datetime.utcnow()
        return before

    if change.change_type == AIProposedChangeType.ADD_SECTION:
        before = {"created_section_id": None}
        section = Section(
            document_id=document.id,
            parent_id=after.get("parent_id"),
            order_index=int(after.get("order_index", len(document.sections or []))),
            heading=str(after.get("heading") or after.get("title") or "Untitled Section"),
            title=str(after.get("heading") or after.get("title") or "Untitled Section"),
            content_md=str(after.get("content_md") or after.get("content") or ""),
            content_lifecycle=SectionContentLifecycle.GENERATED_DRAFT
            if after.get("content_md") or after.get("content")
            else SectionContentLifecycle.EMPTY,
            status=SectionStatus.DRAFT if after.get("content_md") or after.get("content") else SectionStatus.PENDING,
            lifecycle_status=LifecycleStatus.ACTIVE,
            workflow_metadata={"ai_work_run_id": change.work_run_id, "ai_change_id": change.id},
        )
        db.add(section)
        await db.flush()
        after_copy = dict(after)
        after_copy["created_section_id"] = section.id
        change.after_json = after_copy
        return before

    if change.change_type == AIProposedChangeType.REORDER_SECTIONS:
        section_ids = [int(item["section_id"]) for item in after.get("order", []) if "section_id" in item]
        result = await db.execute(
            select(Section).where(Section.document_id == document.id, Section.id.in_(section_ids))
        )
        sections = {section.id: section for section in result.scalars().all()}
        before = {
            "order": [
                {"section_id": section.id, "order_index": section.order_index}
                for section in sections.values()
            ]
        }
        for item in after.get("order", []):
            section = sections.get(int(item["section_id"]))
            if section:
                section.order_index = int(item["order_index"])
                section.updated_at = datetime.utcnow()
        return before

    if change.change_type == AIProposedChangeType.APPLY_OUTLINE_DIFF:
        return await _apply_outline_diff(db, document, change, after)

    raise HTTPException(status_code=400, detail=f"Unsupported AI change type: {change.change_type.value}")


async def _apply_outline_diff(
    db: AsyncSession,
    document: Document,
    change: AIProposedChange,
    after: dict[str, Any],
) -> dict[str, Any]:
    section_ids = set()
    for item in after.get("renamed_sections", []) or after.get("rename_sections", []):
        if isinstance(item, dict) and item.get("section_id") is not None:
            section_ids.add(int(item["section_id"]))
    for section_id in after.get("removed_section_ids", []) or after.get("remove_section_ids", []):
        section_ids.add(int(section_id))
    for item in after.get("order", []):
        if isinstance(item, dict) and item.get("section_id") is not None:
            section_ids.add(int(item["section_id"]))

    sections: dict[int, Section] = {}
    if section_ids:
        result = await db.execute(
            select(Section).where(Section.document_id == document.id, Section.id.in_(section_ids))
        )
        sections = {section.id: section for section in result.scalars().all()}

    before = {
        "sections": [
            {
                "section_id": section.id,
                "heading": section.heading,
                "title": section.title,
                "order_index": section.order_index,
                "parent_id": section.parent_id,
                "lifecycle_status": section.lifecycle_status.value,
            }
            for section in sections.values()
        ],
        "created_section_ids": [],
    }

    created_section_ids: list[int] = []
    for item in after.get("added_sections", []) or after.get("add_sections", []):
        if not isinstance(item, dict):
            continue
        heading = str(item.get("heading") or item.get("title") or "Untitled Section")
        content = str(item.get("content_md") or item.get("content") or "")
        section = Section(
            document_id=document.id,
            parent_id=item.get("parent_id"),
            order_index=int(item.get("order_index", len(sections) + len(created_section_ids))),
            heading=heading,
            title=heading,
            content_md=content,
            content_lifecycle=SectionContentLifecycle.GENERATED_DRAFT if content else SectionContentLifecycle.EMPTY,
            status=SectionStatus.DRAFT if content else SectionStatus.PENDING,
            lifecycle_status=LifecycleStatus.ACTIVE,
            workflow_metadata={"ai_work_run_id": change.work_run_id, "ai_change_id": change.id},
        )
        db.add(section)
        await db.flush()
        created_section_ids.append(section.id)

    for item in after.get("renamed_sections", []) or after.get("rename_sections", []):
        if not isinstance(item, dict) or item.get("section_id") is None:
            continue
        section = sections.get(int(item["section_id"]))
        if not section:
            continue
        heading = str(item.get("after_heading") or item.get("heading") or item.get("title") or section.heading)
        section.heading = heading
        section.title = heading
        section.updated_at = datetime.utcnow()

    for section_id in after.get("removed_section_ids", []) or after.get("remove_section_ids", []):
        section = sections.get(int(section_id))
        if section:
            section.lifecycle_status = LifecycleStatus.ARCHIVED
            section.updated_at = datetime.utcnow()

    for item in after.get("order", []):
        if not isinstance(item, dict) or item.get("section_id") is None:
            continue
        section = sections.get(int(item["section_id"]))
        if section:
            section.order_index = int(item.get("order_index", section.order_index))
            section.updated_at = datetime.utcnow()

    after_copy = dict(after)
    after_copy["created_section_ids"] = created_section_ids
    change.after_json = after_copy
    before["created_section_ids"] = created_section_ids
    return before


async def _undo_change(db: AsyncSession, change: AIProposedChange) -> None:
    before = change.before_json or {}
    if change.change_type == AIProposedChangeType.ADD_SECTION:
        section_id = (change.after_json or {}).get("created_section_id")
        if section_id:
            section = await db.get(Section, section_id)
            if section:
                section.lifecycle_status = LifecycleStatus.ARCHIVED
                section.updated_at = datetime.utcnow()
        return

    if change.change_type == AIProposedChangeType.REORDER_SECTIONS:
        section_ids = [int(item["section_id"]) for item in before.get("order", []) if "section_id" in item]
        result = await db.execute(select(Section).where(Section.id.in_(section_ids)))
        sections = {section.id: section for section in result.scalars().all()}
        for item in before.get("order", []):
            section = sections.get(int(item["section_id"]))
            if section:
                section.order_index = int(item["order_index"])
                section.updated_at = datetime.utcnow()
        return

    if change.change_type == AIProposedChangeType.APPLY_OUTLINE_DIFF:
        for section_id in (change.after_json or {}).get("created_section_ids", []):
            section = await db.get(Section, section_id)
            if section:
                section.lifecycle_status = LifecycleStatus.ARCHIVED
                section.updated_at = datetime.utcnow()
        section_ids = [int(item["section_id"]) for item in before.get("sections", []) if "section_id" in item]
        if section_ids:
            result = await db.execute(select(Section).where(Section.id.in_(section_ids)))
            sections = {section.id: section for section in result.scalars().all()}
            for item in before.get("sections", []):
                section = sections.get(int(item["section_id"]))
                if section:
                    section.heading = item["heading"]
                    section.title = item.get("title") or item["heading"]
                    section.order_index = int(item["order_index"])
                    section.parent_id = item.get("parent_id")
                    section.lifecycle_status = LifecycleStatus(item["lifecycle_status"])
                    section.updated_at = datetime.utcnow()
        return

    section = await db.get(Section, before.get("section_id"))
    if section is None:
        return
    if "content_md" in before:
        section.content_md = before["content_md"]
        section.updated_at = datetime.utcnow()
    if "heading" in before:
        section.heading = before["heading"]
        section.title = before.get("title") or before["heading"]
        section.updated_at = datetime.utcnow()

"""Document setup services for Template Recommendations and Outline Proposals."""

from __future__ import annotations

import json
from datetime import datetime
from app.models.time import utcnow
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.analysis import Analysis
from app.models.clarification import ClarificationRequest, ClarificationStatus
from app.models.document import (
    Document,
    DocumentSetupStage,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)
from app.models.outline_proposal import (
    OutlineProposal,
    OutlineProposalBasis,
    OutlineProposalStatus,
)
from app.models.template import Template
from app.models.template_recommendation import (
    TemplateRecommendation,
    TemplateRecommendationBasis,
)
from app.services.ai_credential_service import get_active_credential
from app.prompts.outline import OUTLINE_SYSTEM, build_outline_user_message
from app.services.ai_service import AiServiceError, complete_text


def _language_names(analysis: Analysis | None) -> list[str]:
    if analysis is None or not analysis.languages_json:
        return []
    data = analysis.languages_json
    if isinstance(data, dict):
        if "languages" in data and isinstance(data["languages"], list):
            return [str(item.get("name", item)).lower() for item in data["languages"]]
        return [str(key).lower() for key in data.keys()]
    if isinstance(data, list):
        return [str(item.get("name", item)).lower() for item in data]
    return []


def _endpoint_count(analysis: Analysis | None) -> int:
    if analysis is None or not analysis.endpoints_json:
        return 0
    data = analysis.endpoints_json
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        endpoints = data.get("endpoints")
        if isinstance(endpoints, list):
            return len(endpoints)
    return 0


def _file_count(analysis: Analysis | None) -> int:
    if analysis is None or not analysis.file_tree_json:
        return 0
    data = analysis.file_tree_json
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        if isinstance(data.get("files"), list):
            return len(data["files"])
        if isinstance(data.get("total_files"), int):
            return data["total_files"]
    return 0


def _framework_names(analysis: Analysis | None) -> list[str]:
    if analysis is None:
        return []
    frameworks: set[str] = set()
    data = analysis.endpoints_json
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("framework"):
                frameworks.add(str(item["framework"]))
    elif isinstance(data, dict):
        raw = data.get("frameworks")
        if isinstance(raw, list):
            frameworks.update(str(item) for item in raw)
        endpoints = data.get("endpoints")
        if isinstance(endpoints, list):
            for item in endpoints:
                if isinstance(item, dict) and item.get("framework"):
                    frameworks.add(str(item["framework"]))
    return sorted(frameworks)


def _complexity_notes(analysis: Analysis | None) -> str:
    if analysis is None or not analysis.complexity_json:
        return ""
    data = analysis.complexity_json
    if isinstance(data, dict):
        for key in ("summary", "notes", "complexity_summary"):
            value = data.get(key)
            if isinstance(value, str):
                return value[:500]
        largest = data.get("largest_files")
        if isinstance(largest, list) and largest:
            paths = [
                str(item.get("path", item))
                for item in largest[:5]
                if isinstance(item, dict) or item
            ]
            return f"Largest files: {', '.join(paths)}"
    return ""


def _analysis_facts(analysis: Analysis | None) -> dict[str, Any]:
    languages = _language_names(analysis)
    endpoint_count = _endpoint_count(analysis)
    file_count = _file_count(analysis)
    has_api = endpoint_count > 0
    has_sdk = any(language in {"typescript", "javascript", "python", "java"} for language in languages)
    return {
        "analysis_id": analysis.id if analysis else None,
        "languages": languages,
        "endpoint_count": endpoint_count,
        "file_count": file_count,
        "has_api_surface": has_api,
        "has_sdk_language": has_sdk,
        "partial_analysis": bool((analysis.analysis_data or {}).get("partial_failure")) if analysis else True,
    }


def _template_traits(template: Template) -> dict[str, Any]:
    traits = template.compatible_repository_traits or {}
    if isinstance(traits, dict):
        return traits
    return {}


def _template_outline(template: Template) -> list[dict[str, Any]]:
    raw = template.outline_preview or template.sections_json or []
    outline: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, dict):
            heading = item.get("heading") or item.get("title") or "Untitled Section"
            outline.append(
                {
                    "heading": str(heading),
                    "description": item.get("description"),
                    "purpose": item.get("purpose"),
                    "guidance": item.get("guidance"),
                    "expected_sources": item.get("expected_sources"),
                }
            )
        else:
            outline.append({"heading": str(item)})
    return outline


def _template_print_profile(template: Template) -> dict[str, Any] | None:
    profile = template.recommended_print_profile
    return dict(profile) if isinstance(profile, dict) else None


def _score_template(template: Template, document: Document, facts: dict[str, Any]) -> tuple[float, list[str]]:
    score = 0.25
    reasons: list[str] = []
    template_text = " ".join(
        value.lower()
        for value in [
            template.name or "",
            template.category or "",
            template.purpose or "",
            template.description or "",
        ]
    )
    document_text = " ".join(
        value.lower()
        for value in [
            document.purpose or "",
            document.audience or "",
            document.context or "",
        ]
    )

    if facts["has_api_surface"] and any(term in template_text for term in ["api", "endpoint", "reference"]):
        score += 0.35
        reasons.append(f"Analysis found {facts['endpoint_count']} endpoint(s).")
    if "architecture" in template_text and facts["file_count"] >= 8:
        score += 0.22
        reasons.append(f"Analysis found a multi-file codebase with {facts['file_count']} file(s).")
    if any(term in template_text for term in ["sdk", "developer", "integration"]) and facts["has_sdk_language"]:
        score += 0.18
        reasons.append("Repository languages fit developer integration documentation.")
    if "api" in document_text and any(term in template_text for term in ["api", "endpoint", "reference"]):
        score += 0.12
        reasons.append("Template purpose matches the Document's API intent.")
    if "architecture" in document_text and "architecture" in template_text:
        score += 0.12
        reasons.append("Template purpose matches the Document's architecture intent.")

    traits = _template_traits(template)
    languages = {language.lower() for language in traits.get("languages", []) if isinstance(language, str)}
    if languages and languages.intersection(set(facts["languages"])):
        score += 0.15
        reasons.append("Template language traits match the analyzed stack.")
    if traits.get("requires_endpoints") and not facts["has_api_surface"]:
        score -= 0.25
        reasons.append("Template expects endpoints, but Analysis did not find any.")
    if facts["partial_analysis"]:
        reasons.append("Recommendation is based on incomplete Analysis facts.")

    if not reasons:
        reasons.append("Template is a general fit for the document purpose and available repository facts.")
    return max(0.0, min(score, 1.0)), reasons


async def get_current_analysis(db: AsyncSession, project_id: int) -> Analysis | None:
    result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project_id, Analysis.is_current == True)  # noqa: E712
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .limit(1)
    )
    analysis = result.scalar_one_or_none()
    if analysis:
        return analysis
    fallback = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project_id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .limit(1)
    )
    return fallback.scalar_one_or_none()


async def list_recommendations(db: AsyncSession, document_id: int) -> list[TemplateRecommendation]:
    result = await db.execute(
        select(TemplateRecommendation)
        .where(TemplateRecommendation.document_id == document_id)
        .options(selectinload(TemplateRecommendation.template))
        .order_by(TemplateRecommendation.score.desc().nullslast(), TemplateRecommendation.created_at.desc())
    )
    return list(result.scalars().all())


async def create_rule_based_recommendations(
    db: AsyncSession,
    document: Document,
    *,
    refresh: bool = False,
) -> list[TemplateRecommendation]:
    existing = [
        recommendation
        for recommendation in await list_recommendations(db, document.id)
        if recommendation.basis == TemplateRecommendationBasis.RULE_BASED
    ]
    if existing and not refresh:
        return existing

    analysis = await get_current_analysis(db, document.project_id)
    facts = _analysis_facts(analysis)
    templates_result = await db.execute(
        select(Template)
        .where(Template.is_builtin == True)  # noqa: E712
        .order_by(Template.name.asc())
    )
    templates = list(templates_result.scalars().all())
    scored = []
    for template in templates:
        score, reasons = _score_template(template, document, facts)
        scored.append((score, reasons, template))
    scored.sort(key=lambda item: item[0], reverse=True)

    recommendations: list[TemplateRecommendation] = []
    for score, reasons, template in scored[:3]:
        recommendation = TemplateRecommendation(
            document_id=document.id,
            analysis_id=analysis.id if analysis else None,
            template_id=template.id,
            basis=TemplateRecommendationBasis.RULE_BASED,
            score=round(score, 3),
            explanation=" ".join(reasons),
            supporting_facts_json=facts,
            provider_usage_ref=None,
        )
        db.add(recommendation)
        recommendations.append(recommendation)

    document.setup_stage = DocumentSetupStage.TEMPLATE_SELECTION
    document.updated_at = utcnow()
    await db.commit()
    return await list_recommendations(db, document.id)


async def create_ai_personalized_recommendation(
    db: AsyncSession,
    document: Document,
    user_id: int,
    *,
    refresh: bool = False,
) -> list[TemplateRecommendation]:
    active = await get_active_credential(db, user_id)
    if active is None:
        raise HTTPException(
            status_code=400,
            detail="Active provider credential required for AI-personalized recommendations.",
        )

    existing = [
        recommendation
        for recommendation in await list_recommendations(db, document.id)
        if recommendation.basis == TemplateRecommendationBasis.AI_PERSONALIZED
    ]
    if existing and not refresh:
        return existing

    base = await create_rule_based_recommendations(db, document, refresh=False)
    top = base[0] if base else None
    analysis = await get_current_analysis(db, document.project_id)
    facts = _analysis_facts(analysis)
    usage = {
        "provider_credential_id": active.id,
        "provider": active.provider,
        "model": active.model_id,
        "estimated_prompt_tokens": 900,
        "estimated_completion_tokens": 250,
        "actual_prompt_tokens": 0,
        "actual_completion_tokens": 0,
        "recorded_at": utcnow().isoformat(),
        "phase": "template_recommendation",
    }
    recommendation = TemplateRecommendation(
        document_id=document.id,
        analysis_id=analysis.id if analysis else None,
        template_id=top.template_id if top else None,
        basis=TemplateRecommendationBasis.AI_PERSONALIZED,
        score=min((top.score or 0.7) + 0.05, 1.0) if top else 0.7,
        explanation=(
            "AI-personalized recommendation is enabled by the active provider and "
            "seeded from persisted Analysis facts. No prose generation was run."
        ),
        supporting_facts_json=facts,
        provider_usage_ref=usage,
    )
    db.add(recommendation)
    document.setup_stage = DocumentSetupStage.TEMPLATE_SELECTION
    document.updated_at = utcnow()
    await db.commit()
    return await list_recommendations(db, document.id)


def _parse_adapted_outline(raw: str) -> list[dict[str, Any]]:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for adapted outline") from exc
    items = parsed.get("sections", parsed) if isinstance(parsed, dict) else parsed
    if not isinstance(items, list):
        raise HTTPException(status_code=502, detail="AI adapted outline must be a JSON array")
    outline: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        heading = str(item.get("heading") or item.get("title") or "").strip()
        if not heading:
            continue
        outline.append(
            {
                "heading": heading,
                "description": item.get("description"),
                "purpose": item.get("purpose"),
                "guidance": item.get("guidance"),
                "expected_sources": item.get("expected_sources"),
                "order_index": int(item.get("order_index", index)),
            }
        )
    if not outline:
        raise HTTPException(status_code=502, detail="AI adapted outline contained no usable sections")
    outline.sort(key=lambda item: item.get("order_index", 0))
    return outline


async def adapt_template_outline(
    db: AsyncSession,
    document: Document,
    template: Template,
    user_id: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    active = await get_active_credential(db, user_id)
    if active is None:
        raise HTTPException(
            status_code=400,
            detail="Active provider credential required for AdaptTemplate.",
        )
    analysis = await get_current_analysis(db, document.project_id)
    facts = _analysis_facts(analysis)
    prompt = build_outline_user_message(
        template_sections=_template_outline(template),
        languages_summary=", ".join(facts["languages"]) or "unknown",
        endpoint_count=facts["endpoint_count"],
        frameworks=", ".join(_framework_names(analysis)) or "unknown",
        file_count=facts["file_count"],
        complexity_notes=_complexity_notes(analysis) or "none",
    )
    try:
        raw = complete_text(
            OUTLINE_SYSTEM,
            prompt,
            active.provider,
            active.api_key,
            active.model_id,
            max_tokens=1800,
        )
    except AiServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    outline = _parse_adapted_outline(raw)
    metadata = {
        "basis": OutlineProposalBasis.ANALYSIS_ADAPTED.value,
        "analysis_id": analysis.id if analysis else None,
        "template_id": template.id,
        "adapt_template": True,
        "provider_usage_ref": {
            "provider_credential_id": active.id,
            "provider": active.provider,
            "model": active.model_id,
            "estimated_prompt_tokens": 1200,
            "estimated_completion_tokens": 450,
            "actual_prompt_tokens": None,
            "actual_completion_tokens": None,
            "phase": "adapt_template",
            "recorded_at": utcnow().isoformat(),
        },
        "supporting_facts": facts,
    }
    return outline, metadata


async def create_custom_outline_seeded_recommendation(
    db: AsyncSession,
    document: Document,
    outline: list[dict[str, Any]],
    explanation: str | None = None,
) -> TemplateRecommendation:
    analysis = await get_current_analysis(db, document.project_id)
    facts = _analysis_facts(analysis)
    recommendation = TemplateRecommendation(
        document_id=document.id,
        analysis_id=analysis.id if analysis else None,
        template_id=None,
        basis=TemplateRecommendationBasis.CUSTOM_OUTLINE_SEEDED,
        score=1.0,
        explanation=explanation or "Custom Outline was selected because built-in Templates did not fit.",
        supporting_facts_json={**facts, "outline_headings": [item.get("heading") for item in outline]},
        provider_usage_ref=None,
    )
    db.add(recommendation)
    document.template_id = None
    document.custom_outline_metadata = {
        "created_at": utcnow().isoformat(),
        "reason": explanation,
        "outline_headings": [item.get("heading") for item in outline],
    }
    document.setup_stage = DocumentSetupStage.OUTLINE_REVIEW
    document.updated_at = utcnow()
    await db.commit()
    await db.refresh(recommendation)
    return recommendation


async def create_outline_proposal(
    db: AsyncSession,
    document: Document,
    *,
    template_id: int | None,
    outline: list[dict[str, Any]] | None,
    basis: OutlineProposalBasis,
    explanation: dict[str, Any] | None,
    user_id: int | None = None,
) -> OutlineProposal:
    analysis = await get_current_analysis(db, document.project_id)
    if template_id is not None:
        template = await db.get(Template, template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")
        if basis == OutlineProposalBasis.ANALYSIS_ADAPTED:
            if user_id is None:
                raise HTTPException(status_code=400, detail="User required for AdaptTemplate")
            outline_json, adapted_explanation = await adapt_template_outline(
                db,
                document,
                template,
                user_id,
            )
            explanation = {**adapted_explanation, **(explanation or {})}
        else:
            outline_json = _template_outline(template)
        document.template_id = template.id
        if document.print_profile is None:
            document.print_profile = _template_print_profile(template)
    elif outline is not None:
        outline_json = outline
        await create_custom_outline_seeded_recommendation(
            db,
            document,
            outline,
            (explanation or {}).get("reason") if explanation else None,
        )
    else:
        raise HTTPException(status_code=400, detail="Template or custom outline required")

    version_result = await db.execute(
        select(OutlineProposal)
        .where(OutlineProposal.document_id == document.id)
        .order_by(OutlineProposal.version.desc())
        .limit(1)
    )
    latest = version_result.scalar_one_or_none()
    proposal = OutlineProposal(
        document_id=document.id,
        analysis_id=analysis.id if analysis else None,
        basis=basis,
        status=OutlineProposalStatus.DRAFT,
        version=(latest.version + 1) if latest else 1,
        outline_json=outline_json,
        explanation_json=explanation
        or {
            "basis": basis.value,
            "analysis_id": analysis.id if analysis else None,
        },
    )
    db.add(proposal)
    document.setup_stage = DocumentSetupStage.OUTLINE_REVIEW
    document.updated_at = utcnow()
    await db.commit()
    await db.refresh(proposal)
    return proposal


async def list_outline_proposals(db: AsyncSession, document_id: int) -> list[OutlineProposal]:
    result = await db.execute(
        select(OutlineProposal)
        .where(OutlineProposal.document_id == document_id)
        .order_by(OutlineProposal.version.desc(), OutlineProposal.created_at.desc())
    )
    return list(result.scalars().all())


async def update_draft_outline_proposal(
    db: AsyncSession,
    proposal: OutlineProposal,
    *,
    outline: list[dict[str, Any]] | None,
    explanation: dict[str, Any] | None,
) -> OutlineProposal:
    if proposal.status != OutlineProposalStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Only draft Outline Proposals can be edited")
    if outline is not None:
        proposal.outline_json = outline
    if explanation is not None:
        proposal.explanation_json = explanation
    await db.commit()
    await db.refresh(proposal)
    return proposal


async def approve_outline_proposal(
    db: AsyncSession,
    document: Document,
    proposal: OutlineProposal,
    user_id: int,
) -> OutlineProposal:
    if proposal.status != OutlineProposalStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Only draft Outline Proposals can be approved")

    existing_sections = await db.execute(select(Section).where(Section.document_id == document.id))
    for section in existing_sections.scalars().all():
        section.lifecycle_status = LifecycleStatus.ARCHIVED

    async def create_sections(items: list[dict[str, Any]], parent_id: int | None = None) -> None:
        for index, item in enumerate(items):
            section = Section(
                document_id=document.id,
                parent_id=parent_id,
                order_index=index,
                heading=str(item.get("heading") or item.get("title") or "Untitled Section"),
                title=str(item.get("heading") or item.get("title") or "Untitled Section"),
                is_custom=proposal.basis == OutlineProposalBasis.CUSTOM_OUTLINE,
                lifecycle_status=LifecycleStatus.ACTIVE,
                confidence_score=item.get("confidence_score"),
                content_md="",
                content_lifecycle=SectionContentLifecycle.EMPTY,
                status=SectionStatus.PENDING,
                workflow_metadata={
                    "outline_proposal_id": proposal.id,
                    "purpose": item.get("purpose"),
                    "description": item.get("description"),
                    "evidence": item.get("evidence"),
                    "guidance": item.get("guidance"),
                    "acceptance_criteria": item.get("acceptance_criteria"),
                    "expected_sources": item.get("expected_sources"),
                },
            )
            db.add(section)
            await db.flush()
            children = item.get("children") or []
            if isinstance(children, list):
                await create_sections(children, section.id)

    await create_sections(proposal.outline_json)

    other_drafts = await db.execute(
        select(OutlineProposal).where(
            OutlineProposal.document_id == document.id,
            OutlineProposal.id != proposal.id,
            OutlineProposal.status == OutlineProposalStatus.DRAFT,
        )
    )
    for draft in other_drafts.scalars().all():
        draft.status = OutlineProposalStatus.SUPERSEDED
        draft.superseded_at = utcnow()

    proposal.status = OutlineProposalStatus.APPROVED
    proposal.approved_by = user_id
    proposal.approved_at = utcnow()
    proposal.approval_metadata = {
        "materialized_sections": len(proposal.outline_json),
        "approved_outline_snapshot": proposal.outline_json,
    }
    document.setup_stage = DocumentSetupStage.GENERATION_MODE
    document.updated_at = utcnow()
    await db.commit()
    await db.refresh(proposal)
    return proposal


async def create_clarification_request(
    db: AsyncSession,
    document: Document,
    proposal: OutlineProposal,
    *,
    question: str,
    affected_sections: list[str],
    confidence_tradeoff: str,
) -> ClarificationRequest:
    request = ClarificationRequest(
        document_id=document.id,
        outline_proposal_id=proposal.id,
        section_id=None,
        question=question,
        affected_sections_json=affected_sections,
        confidence_tradeoff=confidence_tradeoff,
        status=ClarificationStatus.PENDING,
    )
    db.add(request)
    document.setup_stage = DocumentSetupStage.OUTLINE_REVIEW
    document.updated_at = utcnow()
    await db.commit()
    await db.refresh(request)
    return request


async def skip_clarification_request(
    db: AsyncSession,
    request: ClarificationRequest,
) -> ClarificationRequest:
    if request.status != ClarificationStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only pending Clarification Requests can be skipped")
    request.status = ClarificationStatus.SKIPPED
    request.skipped_at = utcnow()
    await db.commit()
    await db.refresh(request)
    return request

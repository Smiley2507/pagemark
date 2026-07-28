import json
import secrets
import asyncio
from datetime import datetime
from app.models.time import utcnow
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user, require_project
from app.models.user import User, UserSettings
from app.models.organization import Organization, OrganizationMember, OrgMemberStatus
from app.models.project import Project, ProjectSourceExclusion, ProjectStatus, SourceType
from app.authz import PROJECT_MANAGE, ORG_AUDIT, require_capability
from app.models.audit import AuditLog
from app.models.document import Document, Section, SectionStatus
from typing import List
from app.schemas.project import (
    AiContextAnalysisSummary,
    AiProjectOverviewResponse,
    AiContextProjectSummary,
    AiContextResponse,
    BriefGenerateResponse,
    ProjectCreateRequest,
    ProjectSourceExclusionRequest,
    ProjectSourceExclusionResponse,
    ProjectUpdateRequest,
    ProjectResponse,
    ProjectListResponse,
)

from fastapi import UploadFile, File, Form
import os as std_os
import shutil
from app.models.analysis import Analysis, AnalysisStatus
from app.schemas.analysis import (
    AnalysisStatusResponse,
    AnalysisResponse,
    OutlineDiffResponse,
    ApplyOutlineResponse,
    GitConnectUrlRequest,
    GitConnectOAuthRequest,
    analysis_to_status_response,
    analysis_to_full_response,
)
from app.services.analysis_service import (
    apply_outline_to_document,
    create_analysis_snapshot,
    get_effective_exclusions,
    get_outline_diff,
    get_latest_analysis,
)
from app.workers.analysis_worker import analyze_project_task, clone_and_analyze_task
from app.services import git_service, github_service, crypto_service, activity_service, ai_credential_service
from app.services.ai_service import AiServiceError, complete_text
from app.services.project_summary_service import summarize_project
from app.models.oauth_token import OAuthToken
from app.config import settings


router = APIRouter(prefix="/projects", tags=["projects"])

# ── Helpers ───────────────────────────────────────────────────────


def _decrypt_github_token_or_400(token_obj: OAuthToken) -> str:
    try:
        token = crypto_service.decrypt_token(token_obj.access_token_encrypted)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="GitHub connection is invalid. Reconnect GitHub and try again.",
        ) from exc

    if not token:
        raise HTTPException(
            status_code=400,
            detail="GitHub connection is invalid. Reconnect GitHub and try again.",
        )
    return token


async def _project_to_response(
    project: Project,
    db: AsyncSession,
    source_exclusions: list[ProjectSourceExclusion] | None = None,
) -> ProjectResponse:
    summary = await summarize_project(db, project)
    return ProjectResponse(
        id=project.id,
        org_id=project.org_id,
        created_by=project.created_by,
        name=project.name,
        description=project.description,
        status=project.status.value,
        completion_pct=summary.completion_pct,
        source_type=project.source_type.value,
        source_provider=project.source_provider,
        source_owner=project.source_owner,
        source_repository=project.source_repository,
        selected_branch=project.selected_branch,
        default_branch=project.default_branch,
        source_visibility=project.source_visibility,
        last_synced_commit=project.last_synced_commit,
        source_metadata=project.source_metadata,
        source_exclusions=[
            ProjectSourceExclusionResponse.model_validate(rule)
            for rule in (source_exclusions or [])
        ],
        context_md=project.context_md,
        starred=project.starred,
        tags=project.tags or [],
        export_settings=project.export_settings,
        webhook_secret=project.webhook_secret,
        webhook_id=project.webhook_id,
        documents_count=summary.documents_count,
        sections_count=summary.sections_count,
        active_generation=summary.active_generation,
        sections_needing_input=summary.sections_needing_input,
        review_state=summary.review_state,
        freshness_state=summary.freshness_state,
        recent_activity_at=summary.recent_activity_at,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


async def _load_source_exclusions(project_id: int, db: AsyncSession) -> list[ProjectSourceExclusion]:
    result = await db.execute(
        select(ProjectSourceExclusion)
        .where(ProjectSourceExclusion.project_id == project_id)
        .order_by(ProjectSourceExclusion.created_at.asc(), ProjectSourceExclusion.id.asc())
    )
    return list(result.scalars().all())


async def _add_missing_exclusion_patterns(
    project: Project,
    patterns: list[str],
    db: AsyncSession,
    current_user: User,
) -> None:
    existing = {rule.pattern for rule in await _load_source_exclusions(project.id, db)}
    for pattern in patterns:
        if pattern and pattern not in existing:
            db.add(
                ProjectSourceExclusion(
                    project_id=project.id,
                    pattern=pattern,
                    reason="User-provided source exclusion",
                    enabled=True,
                    created_by=current_user.id,
                )
            )
            existing.add(pattern)


async def _resolve_org_id(request: Request, current_user: User, db: AsyncSession) -> int:
    """
    Reads org_id from X-Organization-ID header.
    Falls back to the user's personal organization.
    """
    header_val = request.headers.get("X-Organization-ID")
    if header_val:
        try:
            return int(header_val)
        except ValueError:
            pass

    # Fall back to personal org
    res = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
            Organization.personal == True,
        )
        .limit(1)
    )
    org = res.scalar_one_or_none()
    if not org:
        # Fallback: any org the user belongs to
        res2 = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == current_user.id,
                OrganizationMember.status == OrgMemberStatus.ACTIVE,
            ).limit(1)
        )
        member = res2.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=400, detail="User has no organization")
        return member.org_id
    return org.id


async def _get_project(project_id: int, current_user: User, db: AsyncSession) -> Project:
    """
    Fetch a project and verify the current user belongs to its org.
    Raises 404 to prevent IDOR leaks.
    """
    res = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    return project


def _cap_text(value: object, limit: int = 1200) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    return text if len(text) <= limit else f"{text[:limit]}..."


def _as_items(value: object) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("items", "files", "endpoints", "dependencies"):
            nested = value.get(key)
            if isinstance(nested, list):
                return nested
    return []


def _language_names(languages_json: object) -> list[str]:
    if isinstance(languages_json, dict):
        primary = languages_json.get("primary")
        if isinstance(primary, list):
            return [str(item) for item in primary[:8]]
        breakdown = languages_json.get("breakdown")
        if isinstance(breakdown, list):
            return [
                str(item.get("language"))
                for item in breakdown[:8]
                if isinstance(item, dict) and item.get("language")
            ]
        return [str(key) for key in list(languages_json.keys())[:8]]
    if isinstance(languages_json, list):
        return [str(item) for item in languages_json[:8]]
    return []


def _count_files(file_tree_json: object, complexity_json: object) -> int:
    if isinstance(complexity_json, dict) and isinstance(complexity_json.get("total_files"), int):
        return int(complexity_json["total_files"])
    if isinstance(file_tree_json, dict) and isinstance(file_tree_json.get("total_files"), int):
        return int(file_tree_json["total_files"])
    return len(_as_items(file_tree_json))


def _build_context_files_preview(analysis: Analysis | None, limit: int = 8) -> list[dict]:
    if not analysis:
        return []
    contents = analysis.file_contents_json
    preview: list[dict] = []
    if isinstance(contents, dict):
        iterable = contents.items()
    elif isinstance(contents, list):
        iterable = [
            (
                item.get("path") or item.get("file_path") or f"file-{idx + 1}",
                item.get("content") or item,
            )
            for idx, item in enumerate(contents)
            if isinstance(item, dict)
        ]
    else:
        iterable = []
    for path, content in list(iterable)[:limit]:
        preview.append({"path": str(path), "preview": _cap_text(content, 900)})
    return preview


def _build_ai_context_response(
    project: Project,
    analysis: Analysis | None,
    effective_exclusions: list[dict],
) -> AiContextResponse:
    analysis_data = analysis.analysis_data if analysis and isinstance(analysis.analysis_data, dict) else {}
    endpoints = _as_items(analysis.endpoints_json) if analysis else []
    dependencies = _as_items(analysis_data.get("dependencies")) if analysis_data else []
    complexity = analysis.complexity_json if analysis and isinstance(analysis.complexity_json, dict) else {}
    frameworks = []
    if analysis and isinstance(analysis.endpoints_json, dict):
        frameworks = [str(item) for item in (analysis.endpoints_json.get("frameworks") or [])[:8]]

    warnings: list[str] = []
    if not analysis:
        warnings.append("No Analysis snapshot is available. AI can only use the project brief and document context.")
    elif analysis.status != AnalysisStatus.COMPLETED:
        warnings.append(f"Latest Analysis is {analysis.status.value}; source facts may be incomplete.")
    if not (project.context_md or "").strip():
        warnings.append("Project brief/corrections are empty.")
    if analysis_data.get("unavailable_facts"):
        warnings.append("Some Analysis facts are unavailable.")
    if analysis_data.get("partial_failures"):
        warnings.append("Analysis completed with partial failures.")

    status_value = analysis.status.value if analysis else "missing"
    return AiContextResponse(
        project=AiContextProjectSummary(
            id=project.id,
            name=project.name,
            description=project.description,
            source_type=project.source_type.value,
            source_provider=project.source_provider,
            source_repository=project.source_repository,
            selected_branch=project.selected_branch,
            last_synced_commit=project.last_synced_commit,
        ),
        project_brief=project.context_md,
        analysis_summary=AiContextAnalysisSummary(
            id=analysis.id if analysis else None,
            status=status_value,
            is_current=bool(analysis.is_current) if analysis else False,
            completed_at=analysis.completed_at if analysis else None,
            source_commit=analysis.source_commit if analysis else None,
            total_files=_count_files(analysis.file_tree_json, complexity) if analysis else 0,
            languages=_language_names(analysis.languages_json) if analysis else [],
            frameworks=frameworks,
            endpoint_count=len(endpoints),
            dependency_count=len(dependencies),
            largest_files=(complexity.get("largest_files") or [])[:8] if isinstance(complexity, dict) else [],
        ),
        source_connection={
            "type": project.source_type.value,
            "provider": project.source_provider,
            "owner": project.source_owner,
            "repository": project.source_repository,
            "branch": project.selected_branch,
            "metadata": project.source_metadata or {},
        },
        facts={
            "file_tree": _cap_text(analysis.file_tree_json, 2500) if analysis else None,
            "languages": analysis.languages_json if analysis else None,
            "endpoints": endpoints[:20],
            "dependencies": dependencies[:30],
            "complexity": {
                "total_lines": complexity.get("total_lines"),
                "largest_files": (complexity.get("largest_files") or [])[:8],
                "parse_stats": complexity.get("parse_stats"),
            } if complexity else None,
            "source_metadata": analysis.source_metadata if analysis else project.source_metadata,
        },
        unavailable_facts=analysis_data.get("unavailable_facts") or [],
        partial_failures=analysis_data.get("partial_failures") or [],
        effective_exclusions=analysis.effective_exclusions_json if analysis and analysis.effective_exclusions_json is not None else effective_exclusions,
        context_files_preview=_build_context_files_preview(analysis),
        grounding_warnings=warnings,
    )


# ── GET /projects/tags ────────────────────────────────────────────

NOTIFICATION_CATEGORY_MAP: dict[str, str] = {
    "source_webhook_received": "source_sync",
    "source_sync": "source_sync",
    "generation_run_started": "generation",
    "generation_run_completed": "generation",
    "generation_run_failed": "generation",
    "section_generated": "generation",
    "freshness_detected": "stale_sections",
    "freshness_accepted": "stale_sections",
    "freshness_rejected": "stale_sections",
    "document_shared": "document_sharing",
    "share_updated": "document_sharing",
    "share_revoked": "document_sharing",
}

ALWAYS_VISIBLE_EVENTS = {
    "source_webhook_received",
    "analysis_started", "analysis_complete", "analysis_failed",
    "document_created", "outline_approved",
    "section_reviewed", "project_created",
}

DEFAULT_NOTIFICATION_PREFS: dict[str, bool] = {
    "member_activity": True,
    "document_sharing": True,
    "document_notes": True,
    "generation": True,
    "quality": True,
    "stale_sections": True,
    "source_sync": True,
    "invites": True,
}


@router.get("/activity/recent")
async def get_recent_project_activity(
    request: Request,
    limit: int = Query(20, ge=1, le=50),
    days: int | None = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = await _resolve_org_id(request, current_user, db)
    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    require_capability(member_res.scalar_one_or_none(), ORG_AUDIT, user_id=current_user.id)
    events = await activity_service.get_recent_for_org(
        db,
        org_id,
        limit=limit,
        days=days,
    )

    # Filter by user notification preferences
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    user_settings = result.scalar_one_or_none()
    prefs = dict(DEFAULT_NOTIFICATION_PREFS)
    if user_settings and user_settings.notifications_json:
        try:
            stored = json.loads(user_settings.notifications_json)
            prefs.update(stored)
        except (json.JSONDecodeError, TypeError):
            pass

    enabled_categories = {cat for cat, enabled in prefs.items() if enabled}
    filtered = [
        event for event in events
        if event.get("event_type") in ALWAYS_VISIBLE_EVENTS
        or NOTIFICATION_CATEGORY_MAP.get(event.get("event_type", "")) in enabled_categories
    ]
    return {"events": filtered, "total": len(filtered)}

@router.get("/tags")
async def list_tags(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = await _resolve_org_id(request, current_user, db)
    res = await db.execute(
        select(func.unnest(Project.tags)).where(
            Project.org_id == org_id,
            Project.deleted_at.is_(None),
        )
    )
    tags = sorted(set(row[0] for row in res.all() if row[0]))
    return {"tags": tags}


# ── GET /projects ─────────────────────────────────────────────────

@router.get("", response_model=ProjectListResponse)
async def list_projects(
    request: Request,
    search: Optional[str] = Query(None),
    project_status: Optional[str] = Query(None, alias="status"),
    starred: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = await _resolve_org_id(request, current_user, db)

    query = (
        select(Project)
        .where(Project.org_id == org_id, Project.deleted_at.is_(None))
    )

    if search:
        query = query.where(Project.name.ilike(f"%{search}%"))
    if project_status:
        try:
            query = query.where(Project.status == ProjectStatus(project_status))
        except ValueError:
            pass
    if starred is not None:
        query = query.where(Project.starred == starred)

    query = query.order_by(Project.updated_at.desc())
    result = await db.execute(query)
    projects = result.scalars().all()

    responses = []
    for proj in projects:
        responses.append(
            await _project_to_response(
                proj,
                db,
                source_exclusions=await _load_source_exclusions(proj.id, db),
            )
        )

    return ProjectListResponse(projects=responses, total=len(responses))


# ── POST /projects ────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProjectResponse)
async def create_project(
    request: Request,
    body: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = await _resolve_org_id(request, current_user, db)
    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    require_capability(member_res.scalar_one_or_none(), PROJECT_MANAGE, user_id=current_user.id)

    project = Project(
        org_id=org_id,
        created_by=current_user.id,
        name=body.name,
        description=body.description,
        source_type=SourceType(body.source_type.value),
        source_provider=body.source_provider,
        source_owner=body.source_owner,
        source_repository=body.source_repository,
        selected_branch=body.selected_branch,
        default_branch=body.default_branch,
        source_visibility=body.source_visibility,
        source_metadata=body.source_metadata,
    )
    db.add(project)
    await db.flush()
    for rule in body.source_exclusions or []:
        db.add(
            ProjectSourceExclusion(
                project_id=project.id,
                pattern=rule.pattern,
                reason=rule.reason,
                enabled=rule.enabled,
                created_by=current_user.id,
            )
        )
    await db.commit()
    await db.refresh(project)
    source_exclusions = await _load_source_exclusions(project.id, db)

    db.add(AuditLog(
        user_id=current_user.id,
        org_id=org_id,
        action="create_project",
        resource=f"project:{project.id}:name:{project.name}",
    ))
    await db.commit()

    return await _project_to_response(
        project,
        db,
        source_exclusions=source_exclusions,
    )


# ── GET /projects/{id} ───────────────────────────────────────────

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)
    return await _project_to_response(
        project,
        db,
        source_exclusions=await _load_source_exclusions(project.id, db),
    )


# ── PATCH /projects/{id} ─────────────────────────────────────────

@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    body: ProjectUpdateRequest,
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    if body.starred is not None:
        project.starred = body.starred
    if body.tags is not None:
        project.tags = body.tags
    if body.status is not None:
        project.status = ProjectStatus(body.status.value)
    if body.export_settings is not None:
        project.export_settings = body.export_settings

    project.updated_at = utcnow()
    await db.commit()
    await db.refresh(project)

    db.add(AuditLog(
        user_id=current_user.id,
        org_id=project.org_id,
        action="update_project",
        resource=f"project:{project.id}",
    ))
    await db.commit()

    return await _project_to_response(
        project,
        db,
        source_exclusions=await _load_source_exclusions(project.id, db),
    )


@router.get(
    "/{project_id}/source/exclusions",
    response_model=list[ProjectSourceExclusionResponse],
)
async def list_source_exclusions(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)
    return [
        ProjectSourceExclusionResponse.model_validate(rule)
        for rule in await _load_source_exclusions(project.id, db)
    ]


@router.put(
    "/{project_id}/source/exclusions",
    response_model=list[ProjectSourceExclusionResponse],
)
async def replace_source_exclusions(
    body: list[ProjectSourceExclusionRequest],
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await _load_source_exclusions(project.id, db)
    for rule in existing:
        await db.delete(rule)
    await db.flush()
    for rule in body:
        db.add(
            ProjectSourceExclusion(
                project_id=project.id,
                pattern=rule.pattern,
                reason=rule.reason,
                enabled=rule.enabled,
                created_by=current_user.id,
            )
        )
    project.updated_at = utcnow()
    await db.commit()
    return [
        ProjectSourceExclusionResponse.model_validate(rule)
        for rule in await _load_source_exclusions(project.id, db)
    ]


# ── DELETE /projects/{id} ────────────────────────────────────────

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project.deleted_at = utcnow()
    await db.commit()
    db.add(AuditLog(
        user_id=current_user.id,
        org_id=project.org_id,
        action="delete_project",
        resource=f"project:{project_id}:name:{project.name}",
    ))
    await db.commit()


# ── PATCH /projects/{id}/context ─────────────────────────────────

class ProjectContextRequest(BaseModel):
    context_md: Optional[str] = None


@router.patch("/{project_id}/context", response_model=ProjectResponse)
async def update_project_context(
    project_id: int,
    body: "ProjectContextRequest",
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project.context_md = body.context_md
    project.updated_at = utcnow()
    await db.commit()
    await db.refresh(project)

    db.add(AuditLog(
        user_id=current_user.id,
        org_id=project.org_id,
        action="update_project_context",
        resource=f"project:{project_id}",
    ))
    await db.commit()

    return await _project_to_response(
        project,
        db,
    )


# ── POST /projects/{id}/duplicate ────────────────────────────────

@router.post("/{project_id}/duplicate", status_code=status.HTTP_201_CREATED, response_model=ProjectResponse)
async def duplicate_project(
    original: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_project = Project(
        org_id=original.org_id,
        created_by=current_user.id,
        name=f"{original.name} (copy)",
        description=original.description,
        source_type=original.source_type,
        source_provider=original.source_provider,
        source_owner=original.source_owner,
        source_repository=original.source_repository,
        selected_branch=original.selected_branch,
        default_branch=original.default_branch,
        source_visibility=original.source_visibility,
        source_metadata=original.source_metadata,
        export_settings=original.export_settings,
        status=ProjectStatus.PENDING,
    )
    db.add(new_project)
    await db.flush()

    doc_result = await db.execute(select(Document).where(Document.project_id == original.id))
    original_documents = list(doc_result.scalars().all())
    all_new_sections = []
    for orig_doc in original_documents:
        new_doc = Document(project_id=new_project.id, title=orig_doc.title)
        db.add(new_doc)
        await db.flush()

        sec_result = await db.execute(
            select(Section).where(Section.document_id == orig_doc.id).order_by(Section.order_index)
        )
        for orig_sec in sec_result.scalars().all():
            new_section = Section(
                document_id=new_doc.id,
                order_index=orig_sec.order_index,
                heading=orig_sec.heading,
                content_md=orig_sec.content_md,
                status=SectionStatus.PENDING,
            )
            db.add(new_section)
            all_new_sections.append(new_section)

    await db.commit()
    await db.refresh(new_project)
    return await _project_to_response(
        new_project,
        db,
    )


# ── POST /projects/{id}/upload ────────────────────────────────────

@router.post("/{project_id}/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_zip(
    project_id: int,
    file: UploadFile = File(...),
    ignore_patterns: Optional[str] = Form(None),
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")

    project.source_type = SourceType.ZIP
    project.source_provider = None

    upload_dir = f"uploads/{project_id}"
    std_os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    patterns = [p.strip() for p in ignore_patterns.split(",") if p.strip()] if ignore_patterns else []
    await _add_missing_exclusion_patterns(project, patterns, db, current_user)
    await db.flush()
    analysis = await create_analysis_snapshot(
        db,
        project,
        source_type="zip",
        source_path=file_path,
        source_metadata={
            "filename": file.filename,
            "sync_supported": False,
        },
    )
    await db.commit()
    await db.refresh(analysis)

    task = analyze_project_task.delay(project.id, analysis.id, file_path, "zip", ignore_patterns=patterns or None)

    await activity_service.record_event(
        db,
        project_id=project.id,
        event_type="analysis_started",
        message=f"Started analysis for {project.name}",
        payload={"analysis_id": analysis.id, "source_type": "zip"},
    )
    await db.commit()
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/connect-url ──────────────────────────

@router.post("/{project_id}/git/connect-url", status_code=status.HTTP_202_ACCEPTED)
async def connect_public_git(
    body: GitConnectUrlRequest,
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        provider, owner, repo = git_service.validate_git_url(body.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    project.source_type = SourceType.GIT
    project.source_provider = provider
    project.source_owner = owner
    project.source_repository = repo
    project.selected_branch = body.branch
    project.default_branch = project.default_branch or body.branch
    project.source_metadata = {
        **(project.source_metadata or {}),
        "repo_url": body.repo_url,
        "connection_method": "repository_url",
        "sync_supported": True,
    }

    analysis = await create_analysis_snapshot(
        db,
        project,
        source_type="git",
        source_path=body.repo_url,
        source_metadata={
            "repo_url": body.repo_url,
            "connection_method": "repository_url",
            "sync_supported": True,
        },
    )
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, body.repo_url, body.branch)

    await activity_service.record_event(
        db,
        project_id=project.id,
        event_type="analysis_started",
        message=f"Started Git analysis for {body.repo_url}",
        payload={"analysis_id": analysis.id, "repo_url": body.repo_url},
    )
    await db.commit()
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/connect-oauth ────────────────────────

@router.post("/{project_id}/git/connect-oauth", status_code=status.HTTP_202_ACCEPTED)
async def connect_oauth_git(
    body: GitConnectOAuthRequest,
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = "github"
    result = await db.execute(
        select(OAuthToken).where(OAuthToken.user_id == current_user.id, OAuthToken.provider == provider)
    )
    token_obj = result.scalar_one_or_none()
    if not token_obj:
        raise HTTPException(status_code=400, detail="No GitHub connection found.")
    decrypted_token = _decrypt_github_token_or_400(token_obj)

    clone_url = github_service.build_authenticated_clone_url(decrypted_token, body.owner, body.repo)
    repo_url_display = f"https://github.com/{body.owner}/{body.repo}"
    repo_metadata = await github_service.fetch_repo_metadata(
        decrypted_token,
        body.owner,
        body.repo,
    )

    project.source_type = SourceType.GIT
    project.source_provider = provider
    project.source_owner = body.owner
    project.source_repository = body.repo
    project.selected_branch = body.branch
    project.default_branch = repo_metadata.get("default_branch") or body.branch
    project.source_visibility = "private" if repo_metadata.get("private") else "public"
    project.source_metadata = {
        **(project.source_metadata or {}),
        "repo_url": repo_url_display,
        "github_id": repo_metadata.get("id"),
        "html_url": repo_metadata.get("html_url"),
        "connection_method": "github",
        "sync_supported": True,
    }

    try:
        if not project.webhook_secret:
            project.webhook_secret = secrets.token_hex(32)
        webhook_url = f"{settings.BACKEND_URL}/webhooks/github"
        result = await github_service.register_webhook(
            decrypted_token, body.owner, body.repo, webhook_url, project.webhook_secret
        )
        project.webhook_id = result.get("id")
    except Exception:
        pass

    analysis = await create_analysis_snapshot(
        db,
        project,
        source_type="git",
        source_path=clone_url,
        source_metadata={
            "repo_url": repo_url_display,
            "connection_method": "github",
            "sync_supported": True,
        },
    )
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, clone_url, body.branch)

    await activity_service.record_event(
        db,
        project_id=project.id,
        event_type="analysis_started",
        message=f"Started GitHub analysis for {body.owner}/{body.repo}",
        payload={"analysis_id": analysis.id, "repo": f"{body.owner}/{body.repo}"},
    )
    await db.commit()
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/sync ─────────────────────────────────

@router.post("/{project_id}/git/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_git_repo(
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo_url = (project.source_metadata or {}).get("repo_url")
    if project.source_type != SourceType.GIT or not repo_url:
        raise HTTPException(status_code=400, detail="Project is not connected to a Git repository")

    clone_url = repo_url
    if project.source_provider:
        token_res = await db.execute(select(OAuthToken).where(
            OAuthToken.user_id == current_user.id, OAuthToken.provider == project.source_provider
        ))
        token_obj = token_res.scalar_one_or_none()
        if token_obj:
            decrypted = _decrypt_github_token_or_400(token_obj)
            try:
                _, owner, repo = git_service.validate_git_url(repo_url)
                if project.source_provider == 'github':
                    clone_url = github_service.build_authenticated_clone_url(decrypted, owner, repo)
            except Exception:
                pass

    analysis = await create_analysis_snapshot(
        db,
        project,
        source_type="git",
        source_path=clone_url,
        source_metadata={
            "repo_url": repo_url,
            "connection_method": "sync",
            "sync_supported": True,
        },
    )
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, clone_url, project.selected_branch)

    await activity_service.record_event(
        db,
        project_id=project.id,
        event_type="analysis_started",
        message=f"Re-analysis triggered via sync for {project.name}",
        payload={"analysis_id": analysis.id},
    )
    await db.commit()
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── GET /projects/{id}/analysis/status ───────────────────────────

@router.get("/{project_id}/analysis/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_project(project_id, current_user, db)
    analysis_result = await db.execute(
        select(Analysis).where(Analysis.project_id == project_id).order_by(Analysis.created_at.desc()).limit(1)
    )
    analysis = analysis_result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this project")
    return analysis_to_status_response(analysis)


@router.get("/{project_id}/analysis/snapshots", response_model=list[AnalysisStatusResponse])
async def list_analysis_snapshots(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_project(project_id, current_user, db)
    result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project_id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
    )
    return [analysis_to_status_response(item) for item in result.scalars().all()]


@router.get("/{project_id}/analysis/results", response_model=AnalysisResponse)
async def get_analysis_results(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_project(project_id, current_user, db)
    analysis = await get_latest_analysis(project_id, db)
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this project")
    return analysis_to_full_response(analysis)


@router.get("/{project_id}/ai-context", response_model=AiContextResponse)
async def get_project_ai_context(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)
    analysis = await get_latest_analysis(project_id, db)
    effective_exclusions = await get_effective_exclusions(project_id, db)
    return _build_ai_context_response(project, analysis, effective_exclusions)


@router.post("/{project_id}/ai-context/overview", response_model=AiProjectOverviewResponse)
async def generate_project_overview(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)
    analysis = await get_latest_analysis(project_id, db)
    if not analysis or analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Completed Analysis is required before generating a Project overview.")

    credential = await ai_credential_service.get_active_credential(db, current_user.id)
    if credential is None:
        raise HTTPException(status_code=400, detail="Active provider credential required for AI overview generation.")

    effective_exclusions = await get_effective_exclusions(project_id, db)
    context = _build_ai_context_response(project, analysis, effective_exclusions).model_dump(mode="json")
    prompt = (
        "Create a maintainer-reviewable Project Overview from the provided AI Context. "
        "Ground every project-specific claim in the available facts. Do not invent behavior. "
        "If important product intent is missing, list focused questions instead of filling gaps.\n\n"
        "Return only JSON with this shape: "
        "{\"overview_md\":\"<markdown overview>\",\"questions\":[\"<question>\"],\"confidence_score\":<0-100>}.\n\n"
        f"AI Context:\n{json.dumps(context, indent=2)[:12000]}"
    )
    try:
        raw = await asyncio.to_thread(
            complete_text,
            "Return only valid JSON for a grounded Project Overview.",
            prompt,
            credential.provider,
            credential.api_key,
            credential.model_id,
            max_tokens=1800,
        )
    except AiServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for the Project overview.") from exc

    overview = str(parsed.get("overview_md") or "").strip()
    if not overview:
        raise HTTPException(status_code=502, detail="AI did not return a Project overview.")
    questions = parsed.get("questions") if isinstance(parsed.get("questions"), list) else []
    return AiProjectOverviewResponse(
        overview_md=overview,
        questions=[str(item) for item in questions[:8]],
        confidence_score=int(parsed.get("confidence_score") or 0),
    )


@router.post("/{project_id}/brief/generate", response_model=BriefGenerateResponse)
async def generate_project_brief(
    project_id: int,
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = await get_latest_analysis(project_id, db)
    if not analysis or analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Completed Analysis is required before generating a Project Brief.")

    credential = await ai_credential_service.get_active_credential(db, current_user.id)
    if credential is None:
        raise HTTPException(status_code=400, detail="Active provider credential required for brief generation.")

    effective_exclusions = await get_effective_exclusions(project_id, db)
    context = _build_ai_context_response(project, analysis, effective_exclusions).model_dump(mode="json")
    prompt = (
        "You are generating a Project Brief for a maintainer to review and refine. "
        "Ground every project-specific claim in the available Analysis facts below. "
        "Do not invent features, behavior, or intent. "
        "If important product context is missing (purpose, audience, deployment target), "
        "list focused questions instead of guessing.\n\n"
        "Return only valid JSON with this exact shape:\n"
        '{\n'
        '  "overview_md": "<structured markdown — see sections below>",\n'
        '  "questions": ["Question 1?", "Question 2?"],\n'
        '  "confidence_score": <0-100>\n'
        '}\n\n'
        "Structure overview_md with these sections (use ## headings):\n"
        "1. **Project Purpose** — What this project does, inferred from code structure, endpoints, and files.\n"
        "2. **Architecture & Tech Stack** — Primary languages, frameworks, key directories, and their roles.\n"
        "3. **Key Capabilities** — Main features/modules found in the code, with file path references.\n"
        "4. **Configuration & Setup** — Build tools, dependencies, environment requirements (from root config files).\n"
        "5. **Development Status** — What's present vs placeholder (e.g., test directories, CI configs, stub routes).\n\n"
        "Where facts are available, reference them (e.g., language percentages, endpoint counts, file paths). "
        "Where facts are absent, note it as a question instead of inventing.\n\n"
        f"AI Context:\n{json.dumps(context, indent=2)[:12000]}"
    )

    try:
        raw = await asyncio.to_thread(
            complete_text,
            "You are a documentation assistant. Return only valid JSON for a grounded Project Brief.",
            prompt,
            credential.provider,
            credential.api_key,
            credential.model_id,
            max_tokens=2500,
        )
    except AiServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for the Project Brief.") from exc

    overview = str(parsed.get("overview_md") or "").strip()
    if not overview:
        raise HTTPException(status_code=502, detail="AI did not return a Project Brief.")

    project.context_md = overview
    project.updated_at = utcnow()
    await db.commit()

    return BriefGenerateResponse(brief_md=overview)


@router.get("/{project_id}/analysis/outline-diff", response_model=OutlineDiffResponse)
async def get_analysis_outline_diff(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_project(project_id, current_user, db)
    diff = await get_outline_diff(project_id, db)
    return OutlineDiffResponse(**diff)


@router.post("/{project_id}/analysis/apply-outline", response_model=ApplyOutlineResponse)
async def apply_analysis_outline(
    project_id: int,
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = await get_latest_analysis(project_id, db)
    outline_json = getattr(analysis, "outline_json", None) if analysis else None
    if not analysis or not outline_json:
        raise HTTPException(status_code=400, detail="No proposed outline available")
    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis is not complete yet")

    await apply_outline_to_document(project_id, outline_json, db=db)
    setattr(analysis, "outline_applied", True)
    await db.commit()

    doc_result = await db.execute(
        select(Document).where(Document.project_id == project_id).options(selectinload(Document.sections))
    )
    doc = doc_result.scalar_one_or_none()
    count = len(doc.sections) if doc else 0
    return ApplyOutlineResponse(applied=True, section_count=count)


# ── Webhook Management ────────────────────────────────────────────


class WebhookGenerateSecretResponse(BaseModel):
    webhook_url: str
    webhook_secret: str


class WebhookRegisterRequest(BaseModel):
    owner: str
    repo: str


class WebhookRegisterResponse(BaseModel):
    webhook_id: int
    webhook_url: str


@router.post("/{project_id}/webhook/generate-secret", response_model=WebhookGenerateSecretResponse)
async def generate_webhook_secret(
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project.webhook_secret = secrets.token_hex(32)
    project.updated_at = utcnow()
    await db.commit()
    webhook_url = f"{settings.BACKEND_URL}/webhooks/github"
    return WebhookGenerateSecretResponse(
        webhook_url=webhook_url,
        webhook_secret=project.webhook_secret,
    )


@router.post("/{project_id}/webhook/register", response_model=WebhookRegisterResponse)
async def register_github_webhook(
    body: WebhookRegisterRequest,
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not project.webhook_secret:
        raise HTTPException(status_code=400, detail="Generate a webhook secret first")

    token_res = await db.execute(
        select(OAuthToken).where(
            OAuthToken.user_id == current_user.id,
            OAuthToken.provider == "github",
        )
    )
    token_obj = token_res.scalar_one_or_none()
    if not token_obj:
        raise HTTPException(status_code=400, detail="No GitHub connection found")

    decrypted = _decrypt_github_token_or_400(token_obj)
    webhook_url = f"{settings.BACKEND_URL}/webhooks/github"
    result = await github_service.register_webhook(
        decrypted, body.owner, body.repo, webhook_url, project.webhook_secret
    )
    project.webhook_id = result.get("id")
    project.updated_at = utcnow()
    await db.commit()

    return WebhookRegisterResponse(
        webhook_id=result["id"],
        webhook_url=webhook_url,
    )


@router.delete("/{project_id}/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def delete_github_webhook(
    project: Project = Depends(require_project(PROJECT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project.webhook_id:
        token_res = await db.execute(
            select(OAuthToken).where(
                OAuthToken.user_id == current_user.id,
                OAuthToken.provider == "github",
            )
        )
        token_obj = token_res.scalar_one_or_none()
        if token_obj:
            decrypted = _decrypt_github_token_or_400(token_obj)
            await github_service.delete_webhook(
                decrypted, project.source_owner, project.source_repository, project.webhook_id
            )
    project.webhook_id = None
    project.webhook_secret = None
    project.updated_at = utcnow()
    await db.commit()
    return None


# ── Activity Endpoints ────────────────────────────────────────────────


@router.get("/{project_id}/activity")
async def get_project_activity(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event_type: str | None = Query(None),
    days: int | None = Query(None, ge=1, le=365),
    project: Project = Depends(require_project(ORG_AUDIT)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = await activity_service.get_timeline(
        db, project.id,
        limit=limit, offset=offset,
        event_type=event_type, days=days,
    )
    return {"events": events, "total": len(events)}


@router.get("/{project_id}/activity/heatmap")
async def get_project_activity_heatmap(
    days: int = Query(365, ge=1, le=730),
    project: Project = Depends(require_project(ORG_AUDIT)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    heatmap = await activity_service.get_heatmap_data(db, project.id, days=days)
    return heatmap


@router.get("/{project_id}/activity/event-types")
async def get_project_activity_event_types(
    project: Project = Depends(require_project(ORG_AUDIT)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    types = await activity_service.get_event_types(db)
    return {"event_types": types}

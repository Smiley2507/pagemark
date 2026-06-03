from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgMemberStatus
from app.models.project import Project, ProjectStatus, SourceType
from app.models.template import Template
from app.models.document import Document, Section, SectionStatus, LifecycleStatus
from typing import List
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectUpdateRequest,
    ProjectResponse,
    ProjectListResponse,
)
from app.schemas.section import CustomSectionRequest

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
from app.services.analysis_service import apply_outline_to_document, get_outline_diff, get_latest_analysis
from app.workers.analysis_worker import analyze_project_task, clone_and_analyze_task
from app.services import git_service, github_service, gitlab_service, crypto_service
from app.models.oauth_token import OAuthToken


router = APIRouter(prefix="/projects", tags=["projects"])

DEFAULT_SECTIONS = [
    "Project Overview",
    "Installation",
    "Features",
    "Architecture",
    "API Reference",
    "Deployment",
]


# ── Helpers ───────────────────────────────────────────────────────


def _compute_completion_pct(sections: list[Section]) -> float:
    if not sections:
        return 0.0
    finalized = sum(1 for s in sections if s.status == SectionStatus.FINALIZED)
    return round(finalized / len(sections) * 100, 1)


def _project_to_response(project: Project, sections: list[Section]) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        org_id=project.org_id,
        created_by=project.created_by,
        name=project.name,
        description=project.description,
        status=project.status.value,
        completion_pct=_compute_completion_pct(sections),
        source_type=project.source_type.value,
        git_repo_url=project.git_repo_url,
        git_branch=project.git_branch,
        template_id=project.template_id,
        starred=project.starred,
        tags=project.tags or [],
        sections_count=len(sections),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


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
        sec_result = await db.execute(
            select(Section).join(Document).where(Document.project_id == proj.id)
        )
        responses.append(_project_to_response(proj, sec_result.scalars().all()))

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

    project = Project(
        org_id=org_id,
        created_by=current_user.id,
        name=body.name,
        description=body.description,
        source_type=SourceType(body.source_type.value),
        git_repo_url=body.git_repo_url,
        git_branch=body.git_branch,
        template_id=body.template_id,
    )
    db.add(project)
    await db.flush()

    document = Document(project_id=project.id, title="Documentation")
    db.add(document)
    await db.flush()

    section_headings = DEFAULT_SECTIONS
    if body.template_id:
        tmpl_result = await db.execute(select(Template).where(Template.id == body.template_id))
        template = tmpl_result.scalar_one_or_none()
        if template and template.sections_json:
            section_headings = [
                s["heading"] if isinstance(s, dict) else s
                for s in template.sections_json
            ]

    sections = []
    for idx, heading in enumerate(section_headings):
        section = Section(
            document_id=document.id,
            order_index=idx,
            heading=heading,
            content_md="",
            status=SectionStatus.PENDING,
        )
        db.add(section)
        sections.append(section)

    await db.commit()
    await db.refresh(project)
    return _project_to_response(project, sections)


# ── GET /projects/{id} ───────────────────────────────────────────

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)
    sec_result = await db.execute(
        select(Section).join(Document).where(Document.project_id == project.id)
    )
    return _project_to_response(project, sec_result.scalars().all())


# ── PATCH /projects/{id} ─────────────────────────────────────────

@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    body: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)

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

    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)

    sec_result = await db.execute(
        select(Section).join(Document).where(Document.project_id == project.id)
    )
    return _project_to_response(project, sec_result.scalars().all())


# ── DELETE /projects/{id} ────────────────────────────────────────

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)
    project.deleted_at = datetime.utcnow()
    await db.commit()


# ── PATCH /projects/{id}/context ─────────────────────────────────

class ProjectContextRequest(BaseModel):
    context_md: Optional[str] = None


@router.patch("/{project_id}/context", response_model=ProjectResponse)
async def update_project_context(
    project_id: int,
    body: "ProjectContextRequest",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)
    project.context_md = body.context_md
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)

    sec_result = await db.execute(
        select(Section).join(Document).where(Document.project_id == project.id)
    )
    return _project_to_response(project, sec_result.scalars().all())


# ── POST /projects/{id}/duplicate ────────────────────────────────

@router.post("/{project_id}/duplicate", status_code=status.HTTP_201_CREATED, response_model=ProjectResponse)
async def duplicate_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original = await _get_project(project_id, current_user, db)

    new_project = Project(
        org_id=original.org_id,
        created_by=current_user.id,
        name=f"{original.name} (copy)",
        description=original.description,
        source_type=original.source_type,
        git_repo_url=original.git_repo_url,
        git_branch=original.git_branch,
        template_id=original.template_id,
        status=ProjectStatus.PENDING,
    )
    db.add(new_project)
    await db.flush()

    doc_result = await db.execute(select(Document).where(Document.project_id == original.id))
    all_new_sections = []
    for orig_doc in doc_result.scalars().all():
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
    return _project_to_response(new_project, all_new_sections)


# ── POST /projects/{id}/upload ────────────────────────────────────

@router.post("/{project_id}/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_zip(
    project_id: int,
    file: UploadFile = File(...),
    ignore_patterns: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")

    project = await _get_project(project_id, current_user, db)
    project.source_type = SourceType.ZIP

    upload_dir = f"uploads/{project_id}"
    std_os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    analysis = Analysis(project_id=project.id, source_type="zip", source_path=file_path, total_steps=8)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    patterns = [p.strip() for p in ignore_patterns.split(",")] if ignore_patterns else None
    task = analyze_project_task.delay(project.id, analysis.id, file_path, "zip", ignore_patterns=patterns)
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/connect-url ──────────────────────────

@router.post("/{project_id}/git/connect-url", status_code=status.HTTP_202_ACCEPTED)
async def connect_public_git(
    project_id: int,
    body: GitConnectUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        provider, owner, repo = git_service.validate_git_url(body.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    project = await _get_project(project_id, current_user, db)
    project.source_type = SourceType.GIT
    project.git_repo_url = body.repo_url
    project.git_branch = body.branch
    project.git_provider = provider

    analysis = Analysis(project_id=project.id, source_type="git", source_path=body.repo_url, total_steps=8)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, body.repo_url, body.branch)
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/connect-oauth ────────────────────────

@router.post("/{project_id}/git/connect-oauth", status_code=status.HTTP_202_ACCEPTED)
async def connect_oauth_git(
    project_id: int,
    body: GitConnectOAuthRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = body.provider if body.provider in ("github", "gitlab") else "github"
    result = await db.execute(
        select(OAuthToken).where(OAuthToken.user_id == current_user.id, OAuthToken.provider == provider)
    )
    token_obj = result.scalar_one_or_none()
    if not token_obj:
        raise HTTPException(status_code=400, detail=f"No {provider} connection found.")
    decrypted_token = crypto_service.decrypt_token(token_obj.access_token_encrypted)

    if provider == 'github':
        clone_url = github_service.build_authenticated_clone_url(decrypted_token, body.owner, body.repo)
        repo_url_display = f"https://github.com/{body.owner}/{body.repo}"
    elif provider == 'gitlab':
        clone_url = gitlab_service.build_authenticated_clone_url(decrypted_token, f"{body.owner}/{body.repo}")
        repo_url_display = f"https://gitlab.com/{body.owner}/{body.repo}"
    else:
        raise HTTPException(status_code=400, detail="Unknown provider")

    project = await _get_project(project_id, current_user, db)
    project.source_type = SourceType.GIT
    project.git_repo_url = repo_url_display
    project.git_branch = body.branch
    project.git_provider = provider

    analysis = Analysis(project_id=project.id, source_type="git", source_path=clone_url, total_steps=8)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, clone_url, body.branch)
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/sync ─────────────────────────────────

@router.post("/{project_id}/git/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_git_repo(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)
    if project.source_type != SourceType.GIT or not project.git_repo_url:
        raise HTTPException(status_code=400, detail="Project is not connected to a Git repository")

    clone_url = project.git_repo_url
    if project.git_provider:
        token_res = await db.execute(select(OAuthToken).where(
            OAuthToken.user_id == current_user.id, OAuthToken.provider == project.git_provider
        ))
        token_obj = token_res.scalar_one_or_none()
        if token_obj:
            decrypted = crypto_service.decrypt_token(token_obj.access_token_encrypted)
            try:
                _, owner, repo = git_service.validate_git_url(project.git_repo_url)
                if project.git_provider == 'github':
                    clone_url = github_service.build_authenticated_clone_url(decrypted, owner, repo)
                elif project.git_provider == 'gitlab':
                    clone_url = gitlab_service.build_authenticated_clone_url(decrypted, f"{owner}/{repo}")
            except Exception:
                pass

    analysis = Analysis(project_id=project.id, source_type="git", source_path=clone_url, total_steps=8)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, clone_url, project.git_branch)
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_project(project_id, current_user, db)
    analysis = await get_latest_analysis(project_id, db)
    if not analysis or not analysis.outline_json:
        raise HTTPException(status_code=400, detail="No proposed outline available")
    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis is not complete yet")

    await apply_outline_to_document(project_id, analysis.outline_json, db=db)
    analysis.outline_applied = True
    await db.commit()

    doc_result = await db.execute(
        select(Document).where(Document.project_id == project_id).options(selectinload(Document.sections))
    )
    doc = doc_result.scalar_one_or_none()
    count = len(doc.sections) if doc else 0
    return ApplyOutlineResponse(applied=True, section_count=count)

@router.post("/{project_id}/sections", status_code=status.HTTP_201_CREATED, response_model=None)
async def add_custom_section(
    project_id: int,
    body: CustomSectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_project(project_id, current_user, db)

    doc_result = await db.execute(select(Document).where(Document.project_id == project.id))
    document = doc_result.scalar_one()

    # Compute next order_index
    max_index_res = await db.execute(
        select(func.max(Section.order_index)).where(Section.document_id == document.id)
    )
    max_index = max_index_res.scalar() or 0

    new_section = Section(
        document_id=document.id,
        order_index=max_index + 1,
        heading=body.title or "Untitled Section",
        title=body.title,
        is_custom=True,
        lifecycle_status=LifecycleStatus.ACTIVE,
        content_md="",
        status=SectionStatus.PENDING,
    )
    db.add(new_section)
    await db.commit()
    await db.refresh(new_section)

    return {"id": new_section.id, "heading": new_section.heading}

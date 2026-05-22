from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project, ProjectStatus, SourceType
from app.models.template import Template
from app.models.document import Document, Section, SectionStatus
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectUpdateRequest,
    ProjectResponse,
    ProjectListResponse,
)

from fastapi import UploadFile, File
import os as std_os
import shutil
from app.models.analysis import Analysis, AnalysisStatus
from app.schemas.analysis import AnalysisStatusResponse, GitConnectUrlRequest, GitConnectOAuthRequest
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


def _compute_completion_pct(sections: list[Section]) -> float:
    """Completion % = finalized sections / total sections * 100."""
    if not sections:
        return 0.0
    finalized = sum(1 for s in sections if s.status == SectionStatus.FINALIZED)
    return round(finalized / len(sections) * 100, 1)


def _project_to_response(project: Project, sections: list[Section]) -> ProjectResponse:
    completion = _compute_completion_pct(sections)
    return ProjectResponse(
        id=project.id,
        owner_id=project.owner_id,
        name=project.name,
        description=project.description,
        status=project.status.value,
        completion_pct=completion,
        source_type=project.source_type.value,
        git_repo_url=project.git_repo_url,
        git_branch=project.git_branch,
        template_id=project.template_id,
        starred=project.starred,
        sections_count=len(sections),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


# ── GET /projects ────────────────────────────────────────────────

@router.get("", response_model=ProjectListResponse)
async def list_projects(
    search: Optional[str] = Query(None),
    project_status: Optional[str] = Query(None, alias="status"),
    starred: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Project)
        .where(Project.owner_id == current_user.id)
        .where(Project.deleted_at.is_(None))
    )

    if search:
        query = query.where(Project.name.ilike(f"%{search}%"))
    if project_status:
        try:
            status_enum = ProjectStatus(project_status)
            query = query.where(Project.status == status_enum)
        except ValueError:
            pass  # ignore invalid status filter
    if starred is not None:
        query = query.where(Project.starred == starred)

    query = query.order_by(Project.updated_at.desc())
    result = await db.execute(query)
    projects = result.scalars().all()

    # Fetch sections for each project to compute completion %
    responses = []
    for proj in projects:
        sec_result = await db.execute(
            select(Section)
            .join(Document)
            .where(Document.project_id == proj.id)
        )
        sections = sec_result.scalars().all()
        responses.append(_project_to_response(proj, sections))

    return ProjectListResponse(projects=responses, total=len(responses))


# ── POST /projects ───────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProjectResponse)
async def create_project(
    body: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(
        owner_id=current_user.id,
        name=body.name,
        description=body.description,
        source_type=SourceType(body.source_type.value),
        git_repo_url=body.git_repo_url,
        git_branch=body.git_branch,
        template_id=body.template_id,
    )
    db.add(project)
    await db.flush()

    # Create Document
    document = Document(project_id=project.id, title="Documentation")
    db.add(document)
    await db.flush()

    # Decide which sections to create
    section_headings = DEFAULT_SECTIONS

    # If a template is specified, use its sections instead
    if body.template_id:
        tmpl_result = await db.execute(
            select(Template).where(Template.id == body.template_id)
        )
        template = tmpl_result.scalar_one_or_none()
        if template and template.sections_json:
            section_headings = [
                s["heading"] if isinstance(s, dict) else s
                for s in template.sections_json
            ]

    # Create Section rows
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


# ── GET /projects/{id} ──────────────────────────────────────────

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    sec_result = await db.execute(
        select(Section).join(Document).where(Document.project_id == project.id)
    )
    sections = sec_result.scalars().all()

    return _project_to_response(project, sections)


# ── PATCH /projects/{id} ────────────────────────────────────────

@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    body: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    if body.starred is not None:
        project.starred = body.starred
    if body.status is not None:
        project.status = ProjectStatus(body.status.value)

    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)

    sec_result = await db.execute(
        select(Section).join(Document).where(Document.project_id == project.id)
    )
    sections = sec_result.scalars().all()

    return _project_to_response(project, sections)


# ── DELETE /projects/{id} ───────────────────────────────────────

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.deleted_at = datetime.utcnow()
    await db.commit()


# ── POST /projects/{id}/duplicate ────────────────────────────────

@router.post("/{project_id}/duplicate", status_code=status.HTTP_201_CREATED, response_model=ProjectResponse)
async def duplicate_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch the original project
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create new project
    new_project = Project(
        owner_id=current_user.id,
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

    # Deep copy documents and sections
    doc_result = await db.execute(
        select(Document).where(Document.project_id == original.id)
    )
    original_docs = doc_result.scalars().all()

    all_new_sections = []
    for orig_doc in original_docs:
        new_doc = Document(
            project_id=new_project.id,
            title=orig_doc.title,
        )
        db.add(new_doc)
        await db.flush()

        # Copy sections
        sec_result = await db.execute(
            select(Section)
            .where(Section.document_id == orig_doc.id)
            .order_by(Section.order_index)
        )
        original_sections = sec_result.scalars().all()

        for orig_sec in original_sections:
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


# ── POST /projects/{id}/upload ──────────────────────────────────

@router.post("/{project_id}/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_zip(
    project_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")

    # verify project
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.source_type = SourceType.ZIP
    
    upload_dir = f"uploads/{project_id}"
    std_os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # create analysis
    analysis = Analysis(project_id=project.id, source_type="zip", source_path=file_path)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    task = analyze_project_task.delay(project.id, analysis.id, file_path, "zip")
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/connect-url ─────────────────────────

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

    # verify project
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.source_type = SourceType.GIT
    project.git_repo_url = body.repo_url
    project.git_branch = body.branch
    project.git_provider = provider

    analysis = Analysis(project_id=project.id, source_type="git", source_path=body.repo_url)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, body.repo_url, body.branch)
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/connect-oauth ───────────────────────

@router.post("/{project_id}/git/connect-oauth", status_code=status.HTTP_202_ACCEPTED)
async def connect_oauth_git(
    project_id: int,
    body: GitConnectOAuthRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Determine provider (try github first, fallback or parameterize later if needed)
    result = await db.execute(select(OAuthToken).where(OAuthToken.user_id == current_user.id).order_by(OAuthToken.updated_at.desc()))
    token_obj = result.scalars().first()
    if not token_obj:
        raise HTTPException(status_code=400, detail="No OAuth connection found. Please connect GitHub or GitLab first.")

    provider = token_obj.provider
    decrypted_token = crypto_service.decrypt_token(token_obj.access_token_encrypted)

    # Build auth clone url based on provider
    if provider == 'github':
        clone_url = github_service.build_authenticated_clone_url(decrypted_token, body.owner, body.repo)
        repo_url_display = f"https://github.com/{body.owner}/{body.repo}"
    elif provider == 'gitlab':
        clone_url = gitlab_service.build_authenticated_clone_url(decrypted_token, f"{body.owner}/{body.repo}")
        repo_url_display = f"https://gitlab.com/{body.owner}/{body.repo}"
    else:
        raise HTTPException(status_code=400, detail="Unknown provider")

    # verify project
    proj_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None)
        )
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.source_type = SourceType.GIT
    project.git_repo_url = repo_url_display
    project.git_branch = body.branch
    project.git_provider = provider

    analysis = Analysis(project_id=project.id, source_type="git", source_path=clone_url)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, clone_url, body.branch)
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── POST /projects/{id}/git/sync ────────────────────────────────

@router.post("/{project_id}/git/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_git_repo(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project or project.source_type != SourceType.GIT or not project.git_repo_url:
        raise HTTPException(status_code=400, detail="Project is not connected to a Git repository")

    clone_url = project.git_repo_url
    if project.git_provider:
        token_res = await db.execute(select(OAuthToken).where(
            OAuthToken.user_id == current_user.id,
            OAuthToken.provider == project.git_provider
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

    analysis = Analysis(project_id=project.id, source_type="git", source_path=clone_url)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(project.id, analysis.id, clone_url, project.git_branch)
    return {"job_id": task.id, "analysis_id": analysis.id}


# ── GET /projects/{id}/analysis/status ──────────────────────────

@router.get("/{project_id}/analysis/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None)
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    analysis_result = await db.execute(
        select(Analysis).where(Analysis.project_id == project_id).order_by(Analysis.created_at.desc()).limit(1)
    )
    analysis = analysis_result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this project")

    return analysis

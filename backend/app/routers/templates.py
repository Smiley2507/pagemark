from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.template import Template
from app.schemas.template import (
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateResponse,
    TemplateListResponse,
)

router = APIRouter(prefix="/templates", tags=["templates"])


# ── GET /templates ───────────────────────────────────────────────

@router.get("", response_model=TemplateListResponse)
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return built-in templates + current user's custom templates."""
    result = await db.execute(
        select(Template).where(
            (Template.is_builtin == True) | (Template.owner_id == current_user.id)
        )
    )
    templates = result.scalars().all()
    return TemplateListResponse(
        templates=[TemplateResponse.model_validate(t) for t in templates]
    )


# ── POST /templates ──────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, response_model=TemplateResponse)
async def create_template(
    body: TemplateCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = Template(
        name=body.name,
        description=body.description,
        category=body.category,
        sections_json=body.sections_json,
        owner_id=current_user.id,
        is_builtin=False,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


# ── PATCH /templates/{id} ────────────────────────────────────────

@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    body: TemplateUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Template).where(Template.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.is_builtin:
        raise HTTPException(status_code=403, detail="Cannot edit built-in templates")
    if template.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this template")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


# ── DELETE /templates/{id} ───────────────────────────────────────

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Template).where(Template.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.is_builtin:
        raise HTTPException(status_code=403, detail="Cannot delete built-in templates")
    if template.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this template")

    await db.delete(template)
    await db.commit()

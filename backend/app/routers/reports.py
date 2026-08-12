"""
Organization activity reports:
  GET /organizations/{org_id}/reports/summary  — JSON dashboard data (admin/pm)
  GET /organizations/{org_id}/reports/export   — PDF report (admin/pm)
"""
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.organization import Organization, OrgMemberRole
from app.models.user import User
from app.routers.organizations import _get_membership
from app.schemas.report import OrgActivityReport
from app.services.report_service import get_org_report_data, render_report_pdf

router = APIRouter(prefix="/organizations", tags=["reports"])

_REPORT_ROLES = [OrgMemberRole.ADMIN, OrgMemberRole.PROJECT_MANAGER]


async def _get_org_or_404(db: AsyncSession, org_id: int) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def _safe_filename(name: str) -> str:
    return re.sub(r"[^\w\-\. ]", "_", name).strip()


@router.get("/{org_id}/reports/summary", response_model=OrgActivityReport)
async def get_report_summary(
    org_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id, _REPORT_ROLES)
    org = await _get_org_or_404(db, org_id)
    data = await get_org_report_data(db, org_id, days)
    return OrgActivityReport(org_id=org.id, org_name=org.name, **data)


@router.get("/{org_id}/reports/export")
async def export_report_pdf(
    org_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id, _REPORT_ROLES)
    org = await _get_org_or_404(db, org_id)
    data = await get_org_report_data(db, org_id, days)
    try:
        pdf_bytes = render_report_pdf(org.name, data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    safe_name = _safe_filename(f"{org.name}-activity-report-{days}d")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )

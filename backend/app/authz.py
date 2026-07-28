"""Capability-based authorization: a strict role hierarchy over org membership.

VIEWER < TECHNICAL_WRITER < DEVELOPER < PROJECT_MANAGER < ADMIN — each role holds
every capability of the role below it. Depends only on models; routers/dependencies
call into this, never the other way around.
"""
from typing import Optional

from fastapi import HTTPException, status

from app.models.organization import OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.project import Project

PROJECT_READ = "project.read"
CONTENT_COMMENT = "content.comment"
CONTENT_WRITE = "content.write"
DOCUMENT_MANAGE = "document.manage"
CONTENT_REVIEW = "content.review"
PROJECT_MANAGE = "project.manage"
ORG_AUDIT = "org.audit"
ORG_MANAGE = "org.manage"

ROLE_RANK: dict[OrgMemberRole, int] = {
    OrgMemberRole.VIEWER: 0,
    OrgMemberRole.TECHNICAL_WRITER: 1,
    OrgMemberRole.DEVELOPER: 2,
    OrgMemberRole.PROJECT_MANAGER: 3,
    OrgMemberRole.ADMIN: 4,
}

CAPABILITY_MIN_RANK: dict[str, int] = {
    PROJECT_READ: 0,
    CONTENT_COMMENT: 1,
    CONTENT_WRITE: 1,
    DOCUMENT_MANAGE: 1,
    CONTENT_REVIEW: 1,
    PROJECT_MANAGE: 2,
    ORG_AUDIT: 3,
    ORG_MANAGE: 4,
}

# DocumentShare's view < comment < edit ladder only ever substitutes for these
# three capabilities — never for review/manage/org-level ones.
SHARE_PERMISSION_SATISFIES: dict[str, str] = {
    "view": PROJECT_READ,
    "comment": CONTENT_COMMENT,
    "edit": CONTENT_WRITE,
}


def member_can(
    member: Optional[OrganizationMember],
    capability: str,
    *,
    project: Optional[Project] = None,
    user_id: Optional[int] = None,
) -> bool:
    if member is None:
        return False
    if member.status != OrgMemberStatus.ACTIVE:
        return False
    if member.role == OrgMemberRole.ADMIN:
        return True
    if (
        project is not None
        and user_id is not None
        and project.created_by == user_id
        and CAPABILITY_MIN_RANK[capability] <= CAPABILITY_MIN_RANK[PROJECT_MANAGE]
    ):
        return True
    return ROLE_RANK[member.role] >= CAPABILITY_MIN_RANK[capability]


def require_capability(
    member: Optional[OrganizationMember],
    capability: str,
    *,
    project: Optional[Project] = None,
    user_id: Optional[int] = None,
) -> None:
    if not member_can(member, capability, project=project, user_id=user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires {capability}")

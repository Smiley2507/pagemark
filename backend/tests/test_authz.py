"""Pure unit tests for app.authz.member_can — no DB needed, plain model instances."""
import pytest

from app.authz import (
    ROLE_RANK,
    CAPABILITY_MIN_RANK,
    PROJECT_READ,
    CONTENT_COMMENT,
    CONTENT_WRITE,
    DOCUMENT_MANAGE,
    CONTENT_REVIEW,
    PROJECT_MANAGE,
    ORG_AUDIT,
    ORG_MANAGE,
    member_can,
)
from app.models.organization import OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.project import Project

ALL_CAPABILITIES = [
    PROJECT_READ, CONTENT_COMMENT, CONTENT_WRITE, DOCUMENT_MANAGE,
    CONTENT_REVIEW, PROJECT_MANAGE, ORG_AUDIT, ORG_MANAGE,
]


def _member(role: OrgMemberRole, status: OrgMemberStatus = OrgMemberStatus.ACTIVE) -> OrganizationMember:
    return OrganizationMember(org_id=1, user_id=1, role=role, status=status)


@pytest.mark.parametrize("role", list(OrgMemberRole))
@pytest.mark.parametrize("capability", ALL_CAPABILITIES)
def test_member_can_matches_rank_hierarchy(role, capability):
    member = _member(role)
    expected = ROLE_RANK[role] >= CAPABILITY_MIN_RANK[capability]
    assert member_can(member, capability) is expected


def test_none_member_denied_everything():
    for capability in ALL_CAPABILITIES:
        assert member_can(None, capability) is False


def test_inactive_member_denied_even_as_admin():
    member = _member(OrgMemberRole.ADMIN, status=OrgMemberStatus.SUSPENDED)
    for capability in ALL_CAPABILITIES:
        assert member_can(member, capability) is False


def test_project_creator_with_viewer_role_gets_project_manage_and_below():
    project = Project(org_id=1, created_by=42, name="p")
    member = _member(OrgMemberRole.VIEWER)
    for capability in [PROJECT_READ, CONTENT_COMMENT, CONTENT_WRITE, DOCUMENT_MANAGE, CONTENT_REVIEW, PROJECT_MANAGE]:
        assert member_can(member, capability, project=project, user_id=42) is True
    for capability in [ORG_AUDIT, ORG_MANAGE]:
        assert member_can(member, capability, project=project, user_id=42) is False


def test_creator_rule_does_not_apply_to_a_different_project():
    project = Project(org_id=1, created_by=42, name="p")
    member = _member(OrgMemberRole.VIEWER)
    assert member_can(member, PROJECT_MANAGE, project=project, user_id=99) is False


if __name__ == "__main__":
    # ponytail: minimal self-check without pytest, in case the venv isn't wired up yet
    admin = _member(OrgMemberRole.ADMIN)
    assert all(member_can(admin, c) for c in ALL_CAPABILITIES)
    viewer = _member(OrgMemberRole.VIEWER)
    assert member_can(viewer, PROJECT_READ) and not member_can(viewer, CONTENT_WRITE)
    assert member_can(None, ORG_MANAGE) is False
    print("authz self-check ok")

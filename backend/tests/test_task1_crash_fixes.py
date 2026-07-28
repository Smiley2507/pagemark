"""
Minimal regression tests for Task 1's two crash-bug fixes:
- clarification.py referenced Project/OrganizationMember without importing them,
  and compared OrganizationMember.status to a raw string.
- webhooks.py called select(OAuthToken) without importing `select`.
Both raised NameError on any real request before the fix.
"""
import hashlib
import hmac
import json

import pytest

from app.models.project import Project, SourceType


@pytest.fixture
def anyio_backend():
    return "asyncio"


async def test_clarification_endpoint_does_not_nameerror(client):
    """Hitting the clarification lookup for a nonexistent section must 404,
    not 500 — the NameError fired while building the SQLAlchemy query itself,
    regardless of whether any row matches."""
    resp = await client.get("/clarifications/999999")
    assert resp.status_code == 404, resp.text


async def test_webhooks_endpoint_does_not_nameerror(db, client, test_project):
    """Drive a full signed GitHub push through to the OAuthToken lookup line
    that previously NameError'd on the missing `select` import."""
    test_project.source_type = SourceType.GIT
    test_project.source_owner = "octocat"
    test_project.source_repository = "hello-world"
    test_project.webhook_secret = "test-secret"
    await db.commit()

    payload = {
        "repository": {"full_name": "octocat/hello-world"},
        "ref": "refs/heads/main",
    }
    body = json.dumps(payload).encode("utf-8")
    signature = "sha256=" + hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()

    resp = await client.post(
        "/webhooks/github",
        content=body,
        headers={
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "test-delivery",
            "X-Hub-Signature-256": signature,
            "Content-Type": "application/json",
        },
    )
    assert resp.status_code != 500, resp.text

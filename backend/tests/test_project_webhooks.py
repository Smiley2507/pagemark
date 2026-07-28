import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oauth_token import OAuthToken


@pytest.fixture
def anyio_backend():
    return "asyncio"


async def test_webhook_register_rejects_invalid_github_token(
    client: AsyncClient,
    db: AsyncSession,
    test_project,
    test_user,
):
    test_project.webhook_secret = "secret"
    test_project.source_owner = "owner"
    test_project.source_repository = "repo"
    db.add(
        OAuthToken(
            user_id=test_user.id,
            provider="github",
            access_token_encrypted="not-a-fernet-token",
        )
    )
    await db.commit()

    response = await client.post(
        f"/projects/{test_project.id}/webhook/register",
        json={"owner": "owner", "repo": "repo"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "GitHub connection is invalid. Reconnect GitHub and try again."

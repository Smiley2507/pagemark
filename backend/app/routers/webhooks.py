import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.webhook_service import verify_github_signature, find_project_by_repo
from app.services import activity_service
from app.services.analysis_service import create_analysis_snapshot
from app.workers.analysis_worker import clone_and_analyze_task, check_freshness_after_analysis_task
from app.services import github_service, crypto_service
from app.models.oauth_token import OAuthToken

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/github")
async def github_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    event = request.headers.get("X-GitHub-Event")
    delivery = request.headers.get("X-GitHub-Delivery")
    signature = request.headers.get("X-Hub-Signature-256")

    if event != "push":
        return {"status": "ignored", "event": event}

    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")

    body = await request.body()
    payload = json.loads(body)

    repo_full_name = payload.get("repository", {}).get("full_name")
    if not repo_full_name:
        raise HTTPException(status_code=400, detail="Missing repository full_name")

    project = await find_project_by_repo(db, repo_full_name)
    if not project:
        return {"status": "ignored", "reason": "no matching project"}

    if not project.webhook_secret:
        return {"status": "ignored", "reason": "no webhook secret configured"}

    if not verify_github_signature(body, signature, project.webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid signature")

    await activity_service.record_event(
        db,
        project_id=project.id,
        event_type="source_webhook_received",
        message=f"Webhook push event received for {repo_full_name}",
        payload={"delivery": delivery, "ref": payload.get("ref")},
    )

    repo_url = (project.source_metadata or {}).get("repo_url")
    if not repo_url:
        repo_url = f"https://github.com/{repo_full_name}"
        project.source_metadata = {
            **(project.source_metadata or {}),
            "repo_url": repo_url,
        }

    clone_url = repo_url
    token_res = await db.execute(
        select(OAuthToken).where(
            OAuthToken.user_id == project.created_by,
            OAuthToken.provider == "github",
        )
    )
    token_obj = token_res.scalar_one_or_none()
    if token_obj:
        decrypted = crypto_service.decrypt_token(token_obj.access_token_encrypted)
        clone_url = github_service.build_authenticated_clone_url(
            decrypted, project.source_owner, project.source_repository
        )

    analysis = await create_analysis_snapshot(
        db,
        project,
        source_type="git",
        source_path=clone_url,
        source_metadata={
            "repo_url": repo_url,
            "connection_method": "webhook",
            "sync_supported": True,
            "webhook_delivery": delivery,
        },
    )
    await db.commit()
    await db.refresh(analysis)

    task = clone_and_analyze_task.delay(
        project.id, analysis.id, clone_url, project.selected_branch
    )

    check_freshness_after_analysis_task.delay(project.id, analysis.id)

    return {
        "status": "accepted",
        "job_id": task.id,
        "analysis_id": analysis.id,
    }

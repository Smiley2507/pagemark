# Prompt 102 (Future): CI/CD Webhook Integration

## Objective
Keep documentation synced with code by listening for GitHub push events and notifying the project owners that documentation may be stale.

## Context
Code changes faster than documentation. We want Pagemark to act as a safeguard by alerting developers when the codebase is updated so they remember to run the AI Analysis again.

## Requirements
- Expose a public webhook endpoint for GitHub.
- When a push to the `main` or `master` branch occurs, identify which Pagemark Project is tied to that repository.
- Create an in-app Notification and send an Email to the Project Manager and Technical Writer stating: "The repository for [Project] was updated. Do you want to run the AI Analysis to detect documentation drift?"

## Architecture Notes
- The webhook endpoint must be public but secured via an HMAC signature verification using a secret shared with GitHub.

## Backend Tasks
- Build `POST /webhooks/github` router.
- Implement GitHub HMAC signature validation dependency.
- Query the database to find `Project.repo_url == payload.repository.html_url`.
- Trigger an async Celery task to send the drift notification emails via `fastapi-mail`.

## Frontend Tasks
- Add a "Webhook Secret" generation button in Project Settings so users can copy the URL and secret into their GitHub repository settings.
- Display an "Out of Sync" warning banner on the Project Dashboard if a webhook event was received recently but analysis hasn't been re-run.

## Security Considerations
- Never process a webhook payload without validating the `X-Hub-Signature-256` header to prevent malicious actors from spamming your endpoint.
- Webhook endpoints must respond quickly (under 3 seconds). Offload all email/database logic to a Celery background task immediately after verifying the signature.

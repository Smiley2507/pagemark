"""Celery tasks for async email notifications."""
from app.workers.celery_app import celery_app
from app.services.notification_service import send_sync_email, build_email_body


@celery_app.task(bind=True, max_retries=3, acks_late=True)
def send_email_task(self, email_to: str, subject: str, preheader: str, body_html: str):
    try:
        full_html = build_email_body(preheader, body_html)
        send_sync_email(email_to, subject, full_html)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)

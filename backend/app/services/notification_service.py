"""
Notification service — SMTP email alerts via Celery async tasks.

Triggers:
  - Review assigned to a member
  - Comment added to a document
  - Quality score falls below threshold
"""
from pydantic import SecretStr
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from app.config import settings


def _get_mail_conf() -> ConnectionConfig:
    ConnectionConfig.model_rebuild(_types_namespace={"SecretStr": SecretStr})
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_FROM_NAME="Pagemark AI",
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
    )


def send_sync_email(email_to: str, subject: str, body_html: str) -> None:
    """Synchronous email send (used by Celery tasks)."""
    conf = _get_mail_conf()
    message = MessageSchema(
        subject=subject,
        recipients=[email_to],
        body=body_html,
        subtype="html",
    )
    FastMail(conf).send_message(message)


def build_email_body(preheader: str, main_html: str) -> str:
    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:24px;">
<table cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:24px 32px;background:#6366f1;color:#fff;">
<h2 style="margin:0;font-size:18px;">Pagemark AI</h2>
</td></tr>
<tr><td style="padding:24px 32px;">
<p style="color:#6b7280;font-size:13px;margin:0 0 12px;">{preheader}</p>
{main_html}
</td></tr>
</table>
</body>
</html>"""

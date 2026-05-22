import os
from celery import Celery
from app.config import settings

# Initialize Celery
# If REDIS_URL isn't fully configured or isn't available, fallback to memory or 
# another backend during dev, but typically Redis is required for Celery.
celery_app = Celery(
    "pagemark_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

# Optional configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

# Auto-discover tasks in the workers module
celery_app.autodiscover_tasks(["app.workers.analysis_worker"])

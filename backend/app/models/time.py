from datetime import UTC, datetime


def utcnow() -> datetime:
    """Naive UTC timestamp for existing DateTime columns."""
    return datetime.now(UTC).replace(tzinfo=None)

"""Simple in-memory sliding-window rate limiter.

Not persistent across restarts — sufficient for development and
single-worker deployments. Replace with Redis-backed limiter for
horizontal scaling.
"""

import time
from collections import defaultdict
from fastapi import Depends, HTTPException, Request, status


class _MemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.monotonic()
        bucket = self._buckets[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)
        if len(bucket) >= max_requests:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
        bucket.append(now)


_limiter = _MemoryRateLimiter()


def rate_limit(max_requests: int, window_seconds: int = 60):
    def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        _limiter.check(client_ip, max_requests, window_seconds)
    return Depends(dependency)

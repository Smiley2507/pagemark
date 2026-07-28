#!/usr/bin/env python3
"""Smoke-check the Liveblocks authorize-user payload used by collaboration auth."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.routers.documents import _liveblocks_auth_body


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the configured LIVEBLOCKS_SECRET_KEY against /v2/authorize-user.",
    )
    parser.add_argument(
        "--room-id",
        default="project:diagnostic:document:diagnostic:section:diagnostic",
        help="Liveblocks room id to authorize.",
    )
    parser.add_argument(
        "--permission",
        choices=["edit", "comment", "view"],
        default="edit",
        help="Pagemark document permission to model.",
    )
    parser.add_argument(
        "--approved",
        action="store_true",
        help="Model an approved/read-only document.",
    )
    parser.add_argument("--user-id", default="diagnostic-user")
    parser.add_argument("--user-name", default="Liveblocks Diagnostic")
    parser.add_argument("--user-email", default="diagnostic@pagemark.local")
    parser.add_argument("--org-id", default="diagnostic-org")
    return parser.parse_args()


async def main() -> int:
    args = parse_args()
    if not settings.LIVEBLOCKS_SECRET_KEY:
        print("LIVEBLOCKS_SECRET_KEY is not configured.", file=sys.stderr)
        return 2

    payload = _liveblocks_auth_body(
        room_id=args.room_id,
        user_id=args.user_id,
        user_name=args.user_name,
        user_email=args.user_email,
        user_avatar_url=None,
        permission=args.permission,
        org_id=args.org_id,
        approved=args.approved,
    )
    url = f"{settings.LIVEBLOCKS_API_BASE_URL.rstrip('/')}/v2/authorize-user"

    print("Liveblocks authorize-user payload:")
    print(json.dumps(payload, indent=2, sort_keys=True))

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.LIVEBLOCKS_SECRET_KEY}",
                "Content-Type": "application/json",
            },
        )

    print(f"Liveblocks response status: {response.status_code}")
    print(response.text)
    return 0 if response.status_code < 400 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

"""
CLI to manage superuser accounts.

Usage:
    python -m app.bin.superadmin create --email admin@example.com [--name "Admin"]
    python -m app.bin.superadmin list
"""

import argparse
import asyncio
import sys
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import async_session
from app.models.user import User
from app.services import auth_service


async def create_superuser(email: str, name: str | None = None) -> None:
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            if existing.is_superuser:
                print(f"User '{email}' is already a superuser.")
                return
            existing.is_superuser = True
            await db.commit()
            print(f"User '{email}' has been promoted to superuser.")
            return

        password = auth_service.hash_password("changeme")
        user = User(
            email=email,
            name=name or email.split("@")[0],
            password_hash=password,
            is_superuser=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        print(f"Superuser created: {email}")
        print(f"Default password: changeme")
        print(f"IMPORTANT: Ask the user to change their password on first login.")


async def list_superusers() -> None:
    async with async_session() as db:
        result = await db.execute(select(User).where(User.is_superuser == True))
        users = result.scalars().all()

        if not users:
            print("No superusers found.")
            return

        print(f"\n{'ID':<5} {'Email':<35} {'Name':<20} {'Suspended':<10}")
        print("-" * 70)
        for u in users:
            suspended = "Yes" if u.is_suspended else "No"
            print(f"{u.id:<5} {u.email:<35} {(u.name or '-'):<20} {suspended:<10}")
        print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage superuser accounts")
    sub = parser.add_subparsers(dest="command", required=True)

    create_parser = sub.add_parser("create", help="Create or promote a superuser")
    create_parser.add_argument("--email", required=True, help="User email")
    create_parser.add_argument("--name", help="User display name")

    sub.add_parser("list", help="List all superusers")

    args = parser.parse_args()

    if args.command == "create":
        asyncio.run(create_superuser(args.email, args.name))
    elif args.command == "list":
        asyncio.run(list_superusers())
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

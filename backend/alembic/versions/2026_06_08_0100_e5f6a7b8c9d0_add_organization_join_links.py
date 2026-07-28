"""Add organization_join_links table

Revision ID: e5f6a7b8c9d0
Revises: d1e9f2a3b4c5
Create Date: 2026-06-08 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d1e9f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organization_join_links",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("org_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("code", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("role", postgresql.ENUM("ADMIN", "PROJECT_MANAGER", "DEVELOPER", "TECHNICAL_WRITER", "VIEWER", name="orgmemberrole", create_type=False), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("organization_join_links")

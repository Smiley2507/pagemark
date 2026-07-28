"""Add user_ai_credentials and analysis outline_skipped fields

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-22 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_ai_credentials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("api_key_encrypted", sa.String(), nullable=False),
        sa.Column("model_id", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("key_hint", sa.String(), nullable=False),
        sa.Column("validated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "provider", name="uq_user_ai_credentials_user_provider"),
    )
    op.create_index(
        op.f("ix_user_ai_credentials_id"), "user_ai_credentials", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_user_ai_credentials_user_id"),
        "user_ai_credentials",
        ["user_id"],
        unique=False,
    )

    op.add_column(
        "analyses",
        sa.Column("outline_skipped", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("analyses", sa.Column("outline_skip_reason", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("analyses", "outline_skip_reason")
    op.drop_column("analyses", "outline_skipped")
    op.drop_index(op.f("ix_user_ai_credentials_user_id"), table_name="user_ai_credentials")
    op.drop_index(op.f("ix_user_ai_credentials_id"), table_name="user_ai_credentials")
    op.drop_table("user_ai_credentials")

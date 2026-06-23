"""add user mfa (mfa_enabled, user_otp_codes)

Revision ID: 831d4e5f6a7b
Revises: 60c2e1d2f329f3e7
Create Date: 2026-06-23 02:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "831d4e5f6a7b"
down_revision: Union[str, None] = "60c2e1d2f329f3e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.create_table(
        "user_otp_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("purpose", sa.String(), nullable=True, server_default="login"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_otp_codes_id"), "user_otp_codes", ["id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_user_otp_codes_id"), table_name="user_otp_codes")
    op.drop_table("user_otp_codes")
    op.drop_column("user_settings", "mfa_enabled")

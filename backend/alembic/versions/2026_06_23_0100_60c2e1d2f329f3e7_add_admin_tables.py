"""add admin tables (is_superuser, admin_otp_codes, superuser_requests, system_settings)

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2026-06-22 06:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "60c2e1d2f329f3e7"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to users table
    op.add_column("users", sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("is_suspended", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # Create admin_otp_codes table
    op.create_table(
        "admin_otp_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_admin_otp_codes_id"), "admin_otp_codes", ["id"])

    # Create superuser_requests table
    op.create_table(
        "superuser_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("PENDING", "APPROVED", "REJECTED", name="superuserrequeststatus"), nullable=False, server_default="PENDING"),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_superuser_requests_id"), "superuser_requests", ["id"])

    # Create system_settings table with a single default row
    op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("allow_public_signup", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("default_org_quality_threshold", sa.Integer(), nullable=False, server_default=sa.text("70")),
        sa.Column("maintenance_mode", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("max_orgs_per_user", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("admin_session_timeout_minutes", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("otp_expiry_minutes", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_system_settings_id"), "system_settings", ["id"])

    # Insert default system settings row
    op.execute("INSERT INTO system_settings (id) VALUES (1)")


def downgrade() -> None:
    op.drop_table("system_settings")
    op.drop_table("superuser_requests")
    op.drop_table("admin_otp_codes")
    op.drop_column("users", "is_suspended")
    op.drop_column("users", "is_superuser")

    # Clean up the enum type
    op.execute("DROP TYPE IF EXISTS superuserrequeststatus")

"""Add analysis outline_json, step_detail, outline_applied

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("step_detail", sa.String(), nullable=True))
    op.add_column("analyses", sa.Column("outline_json", sa.JSON(), nullable=True))
    op.add_column(
        "analyses",
        sa.Column("outline_applied", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("analyses", "outline_applied")
    op.drop_column("analyses", "outline_json")
    op.drop_column("analyses", "step_detail")

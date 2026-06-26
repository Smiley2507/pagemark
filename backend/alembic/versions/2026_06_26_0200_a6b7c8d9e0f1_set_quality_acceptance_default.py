"""set quality acceptance coverage default

Revision ID: a6b7c8d9e0f1
Revises: 9c1d2e3f4a5b
Create Date: 2026-06-26 02:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, None] = "9c1d2e3f4a5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "quality_reports",
        "acceptance_coverage",
        existing_type=sa.Float(),
        nullable=False,
        server_default=sa.text("100.0"),
    )


def downgrade() -> None:
    op.alter_column(
        "quality_reports",
        "acceptance_coverage",
        existing_type=sa.Float(),
        nullable=False,
        server_default=None,
    )

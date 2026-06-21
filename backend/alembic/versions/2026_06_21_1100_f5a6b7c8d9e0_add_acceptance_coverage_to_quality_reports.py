"""add acceptance coverage to quality reports

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-06-21 11:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quality_reports",
        sa.Column(
            "acceptance_coverage",
            sa.Float(),
            nullable=False,
            server_default=sa.text("100.0"),
        ),
    )
    op.alter_column("quality_reports", "acceptance_coverage", server_default=None)


def downgrade() -> None:
    op.drop_column("quality_reports", "acceptance_coverage")

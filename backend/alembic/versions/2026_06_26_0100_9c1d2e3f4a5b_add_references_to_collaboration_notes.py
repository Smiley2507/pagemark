"""add references to collaboration notes

Revision ID: 9c1d2e3f4a5b
Revises: 831d4e5f6a7b
Create Date: 2026-06-26 01:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c1d2e3f4a5b"
down_revision: Union[str, None] = "831d4e5f6a7b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "collaboration_notes",
        sa.Column("references_json", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("collaboration_notes", "references_json")

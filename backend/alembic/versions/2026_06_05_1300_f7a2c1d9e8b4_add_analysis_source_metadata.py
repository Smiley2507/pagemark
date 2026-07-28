"""add analysis source metadata

Revision ID: f7a2c1d9e8b4
Revises: b13f0a7d9c2e
Create Date: 2026-06-05 13:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a2c1d9e8b4"
down_revision: Union[str, None] = "b13f0a7d9c2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("source_metadata", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("analyses", "source_metadata")

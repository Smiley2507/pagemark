"""add inline editor ai change types

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-06-21 09:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE aiproposedchangetype ADD VALUE IF NOT EXISTS 'INSERT_AT_CURSOR'")
        op.execute("ALTER TYPE aiproposedchangetype ADD VALUE IF NOT EXISTS 'REPLACE_SELECTION'")


def downgrade() -> None:
    # PostgreSQL cannot remove enum values without rebuilding the type. Leaving
    # the values in place is compatible with older application code.
    pass

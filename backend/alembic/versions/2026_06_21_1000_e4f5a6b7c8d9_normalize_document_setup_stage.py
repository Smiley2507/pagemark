"""normalize document setup stage defaults

Revision ID: e4f5a6b7c8d9
Revises: e3f4a5b6c7d8
Create Date: 2026-06-21 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE documents SET setup_stage = 'TEMPLATE_SELECTION' "
            "WHERE setup_stage = 'PURPOSE'"
        )
    )
    op.alter_column(
        "documents",
        "setup_stage",
        server_default=sa.text("'TEMPLATE_SELECTION'"),
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE documents SET setup_stage = 'PURPOSE' "
            "WHERE setup_stage = 'TEMPLATE_SELECTION'"
        )
    )
    op.alter_column(
        "documents",
        "setup_stage",
        server_default=sa.text("'PURPOSE'"),
    )

"""Add section_id column to collaboration_notes

Revision ID: d1e9f2a3b4c5
Revises: 2026_06_05_1600_c8f1d2a3b4c5_phase4_document_setup
Create Date: 2026-06-06 12:08:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "d1e9f2a3b4c5"
down_revision: Union[str, None] = "c8f1d2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "collaboration_notes",
        sa.Column("section_id", sa.Integer(), sa.ForeignKey("sections.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("collaboration_notes", "section_id")

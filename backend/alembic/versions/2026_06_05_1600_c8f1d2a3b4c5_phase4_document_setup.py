"""phase4 document setup

Revision ID: c8f1d2a3b4c5
Revises: f7a2c1d9e8b4
Create Date: 2026-06-05 16:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8f1d2a3b4c5"
down_revision: Union[str, None] = "f7a2c1d9e8b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("templates", sa.Column("purpose", sa.Text(), nullable=True))
    op.add_column("templates", sa.Column("intended_audience", sa.Text(), nullable=True))
    op.add_column("templates", sa.Column("expected_outcome", sa.Text(), nullable=True))
    op.add_column("templates", sa.Column("compatible_repository_traits", sa.JSON(), nullable=True))
    op.add_column("templates", sa.Column("estimated_generation_scope", sa.JSON(), nullable=True))
    op.add_column("templates", sa.Column("outline_preview", sa.JSON(), nullable=True))
    op.add_column("templates", sa.Column("guidance", sa.Text(), nullable=True))

    op.execute("ALTER TYPE clarificationstatus ADD VALUE IF NOT EXISTS 'SKIPPED'")
    op.alter_column("clarification_requests", "section_id", nullable=True)
    op.add_column("clarification_requests", sa.Column("document_id", sa.Integer(), nullable=True))
    op.add_column("clarification_requests", sa.Column("outline_proposal_id", sa.Integer(), nullable=True))
    op.add_column("clarification_requests", sa.Column("affected_sections_json", sa.JSON(), nullable=True))
    op.add_column("clarification_requests", sa.Column("confidence_tradeoff", sa.Text(), nullable=True))
    op.add_column("clarification_requests", sa.Column("skipped_at", sa.DateTime(), nullable=True))
    op.create_foreign_key(
        "clarification_requests_document_id_fkey",
        "clarification_requests",
        "documents",
        ["document_id"],
        ["id"],
    )
    op.create_foreign_key(
        "clarification_requests_outline_proposal_id_fkey",
        "clarification_requests",
        "outline_proposals",
        ["outline_proposal_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "clarification_requests_outline_proposal_id_fkey",
        "clarification_requests",
        type_="foreignkey",
    )
    op.drop_constraint(
        "clarification_requests_document_id_fkey",
        "clarification_requests",
        type_="foreignkey",
    )
    op.drop_column("clarification_requests", "skipped_at")
    op.drop_column("clarification_requests", "confidence_tradeoff")
    op.drop_column("clarification_requests", "affected_sections_json")
    op.drop_column("clarification_requests", "outline_proposal_id")
    op.drop_column("clarification_requests", "document_id")
    op.alter_column("clarification_requests", "section_id", nullable=False)

    op.drop_column("templates", "guidance")
    op.drop_column("templates", "outline_preview")
    op.drop_column("templates", "estimated_generation_scope")
    op.drop_column("templates", "compatible_repository_traits")
    op.drop_column("templates", "expected_outcome")
    op.drop_column("templates", "intended_audience")
    op.drop_column("templates", "purpose")

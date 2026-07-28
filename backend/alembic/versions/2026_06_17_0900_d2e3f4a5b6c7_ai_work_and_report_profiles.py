"""add ai work runs and report profiles

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-06-17 09:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ai_work_run_status = postgresql.ENUM(
    "PENDING",
    "RUNNING",
    "PROPOSED",
    "PARTIALLY_ACCEPTED",
    "ACCEPTED",
    "REJECTED",
    "UNDONE",
    "FAILED",
    name="aiworkrunstatus",
    create_type=False,
)
ai_proposed_change_type = postgresql.ENUM(
    "GENERATE_SECTION",
    "REWRITE_SELECTION",
    "RENAME_SECTION",
    "ADD_SECTION",
    "REORDER_SECTIONS",
    "APPLY_OUTLINE_DIFF",
    name="aiproposedchangetype",
    create_type=False,
)
ai_proposed_change_status = postgresql.ENUM(
    "PROPOSED",
    "ACCEPTED",
    "REJECTED",
    "UNDONE",
    name="aiproposedchangestatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    postgresql.ENUM(
        "PENDING",
        "RUNNING",
        "PROPOSED",
        "PARTIALLY_ACCEPTED",
        "ACCEPTED",
        "REJECTED",
        "UNDONE",
        "FAILED",
        name="aiworkrunstatus",
    ).create(bind, checkfirst=True)
    postgresql.ENUM(
        "GENERATE_SECTION",
        "REWRITE_SELECTION",
        "RENAME_SECTION",
        "ADD_SECTION",
        "REORDER_SECTIONS",
        "APPLY_OUTLINE_DIFF",
        name="aiproposedchangetype",
    ).create(bind, checkfirst=True)
    postgresql.ENUM(
        "PROPOSED",
        "ACCEPTED",
        "REJECTED",
        "UNDONE",
        name="aiproposedchangestatus",
    ).create(bind, checkfirst=True)

    op.add_column("templates", sa.Column("structure_guidance", sa.JSON(), nullable=True))
    op.add_column("templates", sa.Column("section_generation_guidance", sa.JSON(), nullable=True))
    op.add_column("templates", sa.Column("recommended_print_profile", sa.JSON(), nullable=True))
    op.add_column("documents", sa.Column("print_profile", sa.JSON(), nullable=True))

    op.create_table(
        "ai_work_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("prompt_context", sa.JSON(), nullable=True),
        sa.Column("status", ai_work_run_status, nullable=False),
        sa.Column("estimated_prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("estimated_completion_tokens", sa.Integer(), nullable=True),
        sa.Column("estimated_cost", sa.Float(), nullable=True),
        sa.Column("actual_prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("actual_completion_tokens", sa.Integer(), nullable=True),
        sa.Column("actual_cost", sa.Float(), nullable=True),
        sa.Column("undo_group", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_work_runs_id"), "ai_work_runs", ["id"], unique=False)

    op.create_table(
        "ai_proposed_changes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("work_run_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=True),
        sa.Column("change_type", ai_proposed_change_type, nullable=False),
        sa.Column("status", ai_proposed_change_status, nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("before_json", sa.JSON(), nullable=True),
        sa.Column("after_json", sa.JSON(), nullable=False),
        sa.Column("preview_markdown", sa.Text(), nullable=True),
        sa.Column("accepted_by", sa.Integer(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("rejected_by", sa.Integer(), nullable=True),
        sa.Column("rejected_at", sa.DateTime(), nullable=True),
        sa.Column("undone_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["accepted_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.ForeignKeyConstraint(["rejected_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.ForeignKeyConstraint(["work_run_id"], ["ai_work_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_proposed_changes_id"), "ai_proposed_changes", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_proposed_changes_id"), table_name="ai_proposed_changes")
    op.drop_table("ai_proposed_changes")
    op.drop_index(op.f("ix_ai_work_runs_id"), table_name="ai_work_runs")
    op.drop_table("ai_work_runs")
    op.drop_column("documents", "print_profile")
    op.drop_column("templates", "recommended_print_profile")
    op.drop_column("templates", "section_generation_guidance")
    op.drop_column("templates", "structure_guidance")

    bind = op.get_bind()
    postgresql.ENUM(name="aiproposedchangestatus").drop(bind, checkfirst=True)
    postgresql.ENUM(name="aiproposedchangetype").drop(bind, checkfirst=True)
    postgresql.ENUM(name="aiworkrunstatus").drop(bind, checkfirst=True)

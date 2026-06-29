"""add quality findings

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-06-29 01:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "a6b7c8d9e0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


quality_finding_category = postgresql.ENUM(
    "COMPLETENESS",
    "ACCEPTANCE",
    "TERMINOLOGY",
    "LINKS",
    "READABILITY",
    "GRAMMAR",
    "ACCURACY",
    name="qualityfindingcategory",
    create_type=False,
)
quality_finding_status = postgresql.ENUM(
    "OPEN",
    "PROPOSED",
    "RESOLVED",
    "DISMISSED",
    name="qualityfindingstatus",
    create_type=False,
)
issue_severity = postgresql.ENUM("ERROR", "WARNING", "INFO", name="issueseverity", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    postgresql.ENUM(
        "COMPLETENESS",
        "ACCEPTANCE",
        "TERMINOLOGY",
        "LINKS",
        "READABILITY",
        "GRAMMAR",
        "ACCURACY",
        name="qualityfindingcategory",
    ).create(bind, checkfirst=True)
    postgresql.ENUM(
        "OPEN",
        "PROPOSED",
        "RESOLVED",
        "DISMISSED",
        name="qualityfindingstatus",
    ).create(bind, checkfirst=True)

    op.create_table(
        "quality_findings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=True),
        sa.Column("category", quality_finding_category, nullable=False),
        sa.Column("status", quality_finding_status, nullable=False),
        sa.Column("severity", issue_severity, nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=True),
        sa.Column("section_ref", sa.String(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("suggestion", sa.Text(), nullable=True),
        sa.Column("quote", sa.Text(), nullable=True),
        sa.Column("offset", sa.Integer(), nullable=True),
        sa.Column("length", sa.Integer(), nullable=True),
        sa.Column("replacements", sa.JSON(), nullable=True),
        sa.Column("rule_id", sa.String(), nullable=True),
        sa.Column("content_fingerprint", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column("provider_metadata", sa.JSON(), nullable=True),
        sa.Column("stale_location", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("first_seen_at", sa.DateTime(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.ForeignKeyConstraint(["report_id"], ["quality_reports.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "document_id",
            "category",
            "content_fingerprint",
            name="uq_quality_findings_document_category_fingerprint",
        ),
    )
    op.create_index(op.f("ix_quality_findings_id"), "quality_findings", ["id"], unique=False)
    op.create_index(
        "ix_quality_findings_document_status_category",
        "quality_findings",
        ["document_id", "status", "category"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_quality_findings_document_status_category", table_name="quality_findings")
    op.drop_index(op.f("ix_quality_findings_id"), table_name="quality_findings")
    op.drop_table("quality_findings")
    bind = op.get_bind()
    quality_finding_status.drop(bind, checkfirst=True)
    quality_finding_category.drop(bind, checkfirst=True)

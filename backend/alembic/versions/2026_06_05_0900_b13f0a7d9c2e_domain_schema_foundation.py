"""domain schema foundation

Revision ID: b13f0a7d9c2e
Revises: a02e532a9692
Create Date: 2026-06-05 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b13f0a7d9c2e"
down_revision: Union[str, None] = "a02e532a9692"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


documentsetupstage = postgresql.ENUM(
    "PURPOSE",
    "TEMPLATE_SELECTION",
    "OUTLINE_REVIEW",
    "GENERATION_MODE",
    "EDITOR_READY",
    name="documentsetupstage",
    create_type=False,
)
sectioncontentlifecycle = postgresql.ENUM(
    "EMPTY",
    "GENERATED_DRAFT",
    "REVIEWED",
    name="sectioncontentlifecycle",
    create_type=False,
)
outlineproposalbasis = postgresql.ENUM(
    "TEMPLATE",
    "CUSTOM_OUTLINE",
    "ANALYSIS_ADAPTED",
    name="outlineproposalbasis",
    create_type=False,
)
outlineproposalstatus = postgresql.ENUM(
    "DRAFT",
    "APPROVED",
    "SUPERSEDED",
    name="outlineproposalstatus",
    create_type=False,
)
templaterecommendationbasis = postgresql.ENUM(
    "RULE_BASED",
    "AI_PERSONALIZED",
    "CUSTOM_OUTLINE_SEEDED",
    name="templaterecommendationbasis",
    create_type=False,
)
generationmode = postgresql.ENUM(
    "COMPLETE_DOCUMENT",
    "SECTION_ON_DEMAND",
    name="generationmode",
    create_type=False,
)
generationrunstatus = postgresql.ENUM(
    "PENDING",
    "RUNNING",
    "PAUSED",
    "COMPLETED",
    "FAILED",
    "CANCELED",
    name="generationrunstatus",
    create_type=False,
)
generationtaskstatus = postgresql.ENUM(
    "QUEUED",
    "GENERATING",
    "READY",
    "PAUSED",
    "FAILED",
    "SKIPPED",
    name="generationtaskstatus",
    create_type=False,
)
failoverstate = postgresql.ENUM(
    "NOT_REQUIRED",
    "NEEDS_CONFIRMATION",
    "CONFIRMED",
    "DECLINED",
    name="failoverstate",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in (
        documentsetupstage,
        sectioncontentlifecycle,
        outlineproposalbasis,
        outlineproposalstatus,
        templaterecommendationbasis,
        generationmode,
        generationrunstatus,
        generationtaskstatus,
        failoverstate,
    ):
        enum_type.create(bind, checkfirst=True)

    op.drop_constraint("projects_template_id_fkey", "projects", type_="foreignkey")
    op.drop_column("projects", "template_id")
    op.drop_column("projects", "completion_pct")
    op.drop_column("projects", "export_settings")
    op.drop_column("projects", "git_repo_url")
    op.drop_column("projects", "git_branch")
    op.drop_column("projects", "git_provider")

    op.add_column("projects", sa.Column("source_provider", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("source_owner", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("source_repository", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("selected_branch", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("default_branch", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("source_visibility", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("last_synced_commit", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("source_metadata", sa.JSON(), nullable=True))

    op.create_table(
        "project_source_exclusions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("pattern", sa.String(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_source_exclusions_id"), "project_source_exclusions", ["id"], unique=False)

    op.add_column("analyses", sa.Column("source_commit", sa.String(), nullable=True))
    op.add_column("analyses", sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("analyses", sa.Column("effective_exclusions_json", sa.JSON(), nullable=True))
    op.drop_column("analyses", "outline_json")
    op.drop_column("analyses", "outline_applied")
    op.drop_column("analyses", "outline_skipped")
    op.drop_column("analyses", "outline_skip_reason")

    op.add_column("documents", sa.Column("template_id", sa.Integer(), nullable=True))
    op.add_column(
        "documents",
        sa.Column(
            "setup_stage",
            documentsetupstage,
            nullable=False,
            server_default="PURPOSE",
        ),
    )
    op.add_column("documents", sa.Column("purpose", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("audience", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("context", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("custom_outline_metadata", sa.JSON(), nullable=True))
    op.add_column("documents", sa.Column("tags", sa.JSON(), nullable=True))
    op.add_column("documents", sa.Column("export_settings", sa.JSON(), nullable=True))
    op.add_column("documents", sa.Column("freshness_state", sa.String(), nullable=True))
    op.add_column("documents", sa.Column("sharing_settings", sa.JSON(), nullable=True))
    op.create_foreign_key("documents_template_id_fkey", "documents", "templates", ["template_id"], ["id"])
    op.alter_column("documents", "setup_stage", server_default=None)

    op.add_column(
        "sections",
        sa.Column(
            "content_lifecycle",
            sectioncontentlifecycle,
            nullable=False,
            server_default="EMPTY",
        ),
    )
    op.add_column("sections", sa.Column("needs_input", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("sections", sa.Column("is_generating", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("sections", sa.Column("has_failed", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("sections", sa.Column("is_potentially_stale", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("sections", sa.Column("workflow_metadata", sa.JSON(), nullable=True))
    op.add_column("sections", sa.Column("reviewed_by", sa.Integer(), nullable=True))
    op.add_column("sections", sa.Column("reviewed_at", sa.DateTime(), nullable=True))
    op.add_column("sections", sa.Column("reviewed_against_analysis_id", sa.Integer(), nullable=True))
    op.create_foreign_key("sections_reviewed_by_fkey", "sections", "users", ["reviewed_by"], ["id"])
    op.create_foreign_key(
        "sections_reviewed_against_analysis_id_fkey",
        "sections",
        "analyses",
        ["reviewed_against_analysis_id"],
        ["id"],
    )
    op.alter_column("sections", "content_lifecycle", server_default=None)

    op.create_table(
        "outline_proposals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("analysis_id", sa.Integer(), nullable=True),
        sa.Column("basis", outlineproposalbasis, nullable=False),
        sa.Column("status", outlineproposalstatus, nullable=False, server_default="DRAFT"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("outline_json", sa.JSON(), nullable=False),
        sa.Column("explanation_json", sa.JSON(), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("approval_metadata", sa.JSON(), nullable=True),
        sa.Column("superseded_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_outline_proposals_id"), "outline_proposals", ["id"], unique=False)

    op.create_table(
        "template_recommendations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("analysis_id", sa.Integer(), nullable=True),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("basis", templaterecommendationbasis, nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("supporting_facts_json", sa.JSON(), nullable=True),
        sa.Column("provider_usage_ref", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"]),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_template_recommendations_id"), "template_recommendations", ["id"], unique=False)

    op.create_table(
        "generation_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("mode", generationmode, nullable=False),
        sa.Column("intended_provider", sa.String(), nullable=True),
        sa.Column("intended_model", sa.String(), nullable=True),
        sa.Column("status", generationrunstatus, nullable=False, server_default="PENDING"),
        sa.Column("failover_state", failoverstate, nullable=False, server_default="NOT_REQUIRED"),
        sa.Column("estimated_prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("estimated_completion_tokens", sa.Integer(), nullable=True),
        sa.Column("estimated_cost", sa.Float(), nullable=True),
        sa.Column("actual_prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("actual_completion_tokens", sa.Integer(), nullable=True),
        sa.Column("actual_cost", sa.Float(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("run_metadata", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_generation_runs_id"), "generation_runs", ["id"], unique=False)

    op.create_table(
        "generation_section_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("generation_run_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("status", generationtaskstatus, nullable=False, server_default="QUEUED"),
        sa.Column("dependency_section_ids", sa.JSON(), nullable=True),
        sa.Column("actual_provider", sa.String(), nullable=True),
        sa.Column("actual_model", sa.String(), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("task_metadata", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["generation_run_id"], ["generation_runs.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_generation_section_tasks_id"), "generation_section_tasks", ["id"], unique=False)

    op.create_table(
        "evidence_references",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("claim_anchor", sa.String(), nullable=True),
        sa.Column("analysis_id", sa.Integer(), nullable=False),
        sa.Column("artifact_type", sa.String(), nullable=False),
        sa.Column("path", sa.String(), nullable=True),
        sa.Column("symbol", sa.String(), nullable=True),
        sa.Column("line_range_hint", sa.JSON(), nullable=True),
        sa.Column("reference_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_evidence_references_id"), "evidence_references", ["id"], unique=False)

    op.create_table(
        "activity_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("analysis_id", sa.Integer(), nullable=True),
        sa.Column("document_id", sa.Integer(), nullable=True),
        sa.Column("section_id", sa.Integer(), nullable=True),
        sa.Column("generation_run_id", sa.Integer(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"]),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.ForeignKeyConstraint(["generation_run_id"], ["generation_runs.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_activity_events_id"), "activity_events", ["id"], unique=False)

    op.create_table(
        "workspace_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("surface", sa.String(), nullable=False),
        sa.Column("context_id", sa.String(), nullable=True),
        sa.Column("preferences_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "surface",
            "context_id",
            name="uq_workspace_preferences_user_surface_context",
        ),
    )
    op.create_index(op.f("ix_workspace_preferences_id"), "workspace_preferences", ["id"], unique=False)

    op.drop_constraint("uq_quality_reports_project_id", "quality_reports", type_="unique")
    op.drop_constraint("quality_reports_project_id_fkey", "quality_reports", type_="foreignkey")
    op.drop_column("quality_reports", "project_id")
    op.add_column("quality_reports", sa.Column("document_id", sa.Integer(), nullable=False))
    op.create_foreign_key("quality_reports_document_id_fkey", "quality_reports", "documents", ["document_id"], ["id"])
    op.create_unique_constraint("uq_quality_reports_document_id", "quality_reports", ["document_id"])


def downgrade() -> None:
    op.drop_constraint("uq_quality_reports_document_id", "quality_reports", type_="unique")
    op.drop_constraint("quality_reports_document_id_fkey", "quality_reports", type_="foreignkey")
    op.drop_column("quality_reports", "document_id")
    op.add_column("quality_reports", sa.Column("project_id", sa.Integer(), nullable=False))
    op.create_foreign_key("quality_reports_project_id_fkey", "quality_reports", "projects", ["project_id"], ["id"])
    op.create_unique_constraint("uq_quality_reports_project_id", "quality_reports", ["project_id"])

    op.drop_index(op.f("ix_workspace_preferences_id"), table_name="workspace_preferences")
    op.drop_table("workspace_preferences")
    op.drop_index(op.f("ix_activity_events_id"), table_name="activity_events")
    op.drop_table("activity_events")
    op.drop_index(op.f("ix_evidence_references_id"), table_name="evidence_references")
    op.drop_table("evidence_references")
    op.drop_index(op.f("ix_generation_section_tasks_id"), table_name="generation_section_tasks")
    op.drop_table("generation_section_tasks")
    op.drop_index(op.f("ix_generation_runs_id"), table_name="generation_runs")
    op.drop_table("generation_runs")
    op.drop_index(op.f("ix_template_recommendations_id"), table_name="template_recommendations")
    op.drop_table("template_recommendations")
    op.drop_index(op.f("ix_outline_proposals_id"), table_name="outline_proposals")
    op.drop_table("outline_proposals")

    op.drop_constraint("sections_reviewed_against_analysis_id_fkey", "sections", type_="foreignkey")
    op.drop_constraint("sections_reviewed_by_fkey", "sections", type_="foreignkey")
    op.drop_column("sections", "reviewed_against_analysis_id")
    op.drop_column("sections", "reviewed_at")
    op.drop_column("sections", "reviewed_by")
    op.drop_column("sections", "workflow_metadata")
    op.drop_column("sections", "is_potentially_stale")
    op.drop_column("sections", "has_failed")
    op.drop_column("sections", "is_generating")
    op.drop_column("sections", "needs_input")
    op.drop_column("sections", "content_lifecycle")

    op.drop_constraint("documents_template_id_fkey", "documents", type_="foreignkey")
    op.drop_column("documents", "sharing_settings")
    op.drop_column("documents", "freshness_state")
    op.drop_column("documents", "export_settings")
    op.drop_column("documents", "tags")
    op.drop_column("documents", "custom_outline_metadata")
    op.drop_column("documents", "context")
    op.drop_column("documents", "audience")
    op.drop_column("documents", "purpose")
    op.drop_column("documents", "setup_stage")
    op.drop_column("documents", "template_id")

    op.add_column("analyses", sa.Column("outline_skip_reason", sa.String(), nullable=True))
    op.add_column("analyses", sa.Column("outline_skipped", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("analyses", sa.Column("outline_applied", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("analyses", sa.Column("outline_json", sa.JSON(), nullable=True))
    op.drop_column("analyses", "effective_exclusions_json")
    op.drop_column("analyses", "is_current")
    op.drop_column("analyses", "source_commit")

    op.drop_index(op.f("ix_project_source_exclusions_id"), table_name="project_source_exclusions")
    op.drop_table("project_source_exclusions")
    op.drop_column("projects", "source_metadata")
    op.drop_column("projects", "last_synced_commit")
    op.drop_column("projects", "source_visibility")
    op.drop_column("projects", "default_branch")
    op.drop_column("projects", "selected_branch")
    op.drop_column("projects", "source_repository")
    op.drop_column("projects", "source_owner")
    op.drop_column("projects", "source_provider")
    op.add_column("projects", sa.Column("git_provider", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("git_branch", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("git_repo_url", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("export_settings", sa.JSON(), nullable=True))
    op.add_column("projects", sa.Column("completion_pct", sa.Float(), nullable=True))
    op.add_column("projects", sa.Column("template_id", sa.Integer(), nullable=True))
    op.create_foreign_key("projects_template_id_fkey", "projects", "templates", ["template_id"], ["id"])

    bind = op.get_bind()
    for enum_type in (
        failoverstate,
        generationtaskstatus,
        generationrunstatus,
        generationmode,
        templaterecommendationbasis,
        outlineproposalstatus,
        outlineproposalbasis,
        sectioncontentlifecycle,
        documentsetupstage,
    ):
        enum_type.drop(bind, checkfirst=True)

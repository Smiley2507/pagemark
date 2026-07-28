"""add resources and file_contents_json

Revision ID: f1a2b3c4d5e6
Revises: e10f79a81207
Create Date: 2026-06-08 03:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e10f79a81207"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "resources",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "upload", "note", "document", "section",
                "repo_file", "symbol", "analysis", "transient",
                name="resourcetype",
            ),
            nullable=False,
        ),
        sa.Column("original_name", sa.String(), nullable=False),
        sa.Column("mime_type", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("data", sa.LargeBinary(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("thumbnail", sa.LargeBinary(), nullable=True),
        sa.Column("reference_type", sa.String(), nullable=True),
        sa.Column("reference_id", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("symbol_name", sa.String(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "chat_message_resources",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("message_id", sa.Integer(), sa.ForeignKey("chat_messages.id"), nullable=False),
        sa.Column("resource_id", sa.Integer(), sa.ForeignKey("resources.id"), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
    )

    op.add_column("analyses", sa.Column("file_contents_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("analyses", "file_contents_json")
    op.drop_table("chat_message_resources")
    op.drop_table("resources")
    op.execute("DROP TYPE IF EXISTS resourcetype")

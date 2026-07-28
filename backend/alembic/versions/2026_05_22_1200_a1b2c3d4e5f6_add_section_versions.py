"""add section_versions table

Revision ID: a1b2c3d4e5f6
Revises: 78d9ee9f0086
Create Date: 2026-05-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "78d9ee9f0086"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "section_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("content_md", sa.Text(), nullable=False),
        sa.Column(
            "author_type",
            sa.Enum("user", "ai", name="authortype"),
            nullable=False,
        ),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("added", sa.Integer(), nullable=False),
        sa.Column("removed", sa.Integer(), nullable=False),
        sa.Column("modified", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_section_versions_id"), "section_versions", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_section_versions_id"), table_name="section_versions")
    op.drop_table("section_versions")
    op.execute("DROP TYPE IF EXISTS authortype")

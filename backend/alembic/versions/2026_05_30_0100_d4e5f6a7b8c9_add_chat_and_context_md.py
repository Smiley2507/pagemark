"""Add chat_threads, chat_messages, and projects.context_md

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-30 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── projects.context_md ──────────────────────────────────────
    op.add_column(
        "projects",
        sa.Column("context_md", sa.Text(), nullable=True),
    )

    # ── chat_threads ─────────────────────────────────────────────
    op.create_table(
        "chat_threads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False, server_default="New Chat"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_threads_id"), "chat_threads", ["id"], unique=False)
    op.create_index(
        op.f("ix_chat_threads_project_id"), "chat_threads", ["project_id"], unique=False
    )

    # ── chat_messages ────────────────────────────────────────────
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column(
            "role",
            sa.Enum("USER", "AI", name="messagerole"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["thread_id"], ["chat_threads.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chat_messages_id"), "chat_messages", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_chat_messages_thread_id"), "chat_messages", ["thread_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_messages_thread_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_id"), table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index(op.f("ix_chat_threads_project_id"), table_name="chat_threads")
    op.drop_index(op.f("ix_chat_threads_id"), table_name="chat_threads")
    op.drop_table("chat_threads")

    # Drop enum type created for chat_messages.role
    op.execute("DROP TYPE IF EXISTS messagerole")

    op.drop_column("projects", "context_md")

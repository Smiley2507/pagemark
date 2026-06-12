"""Add webhook_secret and webhook_id to Project model

Revision ID: c1d2e3f4a5b6
Revises: bb037f5dff4f
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'bb037f5dff4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('webhook_secret', sa.String(), nullable=True))
    op.add_column('projects', sa.Column('webhook_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'webhook_id')
    op.drop_column('projects', 'webhook_secret')

"""add telegram_chat_id to users

Revision ID: 70f7b44b55fb
Revises: a1b2c3d4e5f6
Create Date: 2026-06-19 18:36:25.007290

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '70f7b44b55fb'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("telegram_chat_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "telegram_chat_id")

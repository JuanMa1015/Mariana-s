"""add alias (nombre del cliente) to procesos

Revision ID: d4e8a1c6b390
Revises: b7e9c4f8a2d5
Create Date: 2026-10-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e8a1c6b390"
down_revision: Union[str, Sequence[str], None] = "b7e9c4f8a2d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("procesos", sa.Column("alias", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("procesos", "alias")

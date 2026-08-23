"""add canales_notificados to procesos

Revision ID: f6a7b8c9d0e1
Revises: c3f7a9b1d2e4
Create Date: 2026-08-22 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "c3f7a9b1d2e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("procesos", sa.Column("canales_notificados", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("procesos", "canales_notificados")

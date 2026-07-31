"""add notification retry columns to procesos

Revision ID: 8a3c5d2e9f01
Revises: 70f7b44b55fb
Create Date: 2026-07-31 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a3c5d2e9f01"
down_revision: Union[str, Sequence[str], None] = "70f7b44b55fb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("procesos", sa.Column("notificacion_pendiente", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("procesos", sa.Column("intentos_notificacion", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.add_column("procesos", sa.Column("ultima_notificacion_intento", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("procesos", "ultima_notificacion_intento")
    op.drop_column("procesos", "intentos_notificacion")
    op.drop_column("procesos", "notificacion_pendiente")

"""add indexes on sync and notification columns

Revision ID: b2c3d4e5f607
Revises: 8a3c5d2e9f01
Create Date: 2026-07-30 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f607"
down_revision: Union[str, Sequence[str], None] = "8a3c5d2e9f01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_procesos_ultima_sincronizacion", "procesos", ["ultima_sincronizacion"])
    op.create_index("ix_procesos_fecha_ultima_actuacion", "procesos", ["fecha_ultima_actuacion"])
    op.create_index("ix_procesos_notificacion_pendiente", "procesos", ["notificacion_pendiente"])


def downgrade() -> None:
    op.drop_index("ix_procesos_notificacion_pendiente", table_name="procesos")
    op.drop_index("ix_procesos_fecha_ultima_actuacion", table_name="procesos")
    op.drop_index("ix_procesos_ultima_sincronizacion", table_name="procesos")

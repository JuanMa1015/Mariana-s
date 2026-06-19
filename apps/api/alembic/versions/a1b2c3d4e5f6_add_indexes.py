"""add indexes on user_id notificado categoria

Revision ID: a1b2c3d4e5f6
Revises: 570af04fcbf6
Create Date: 2026-06-19 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "570af04fcbf6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_procesos_user_id", "procesos", ["user_id"])
    op.create_index("ix_procesos_user_id_notificado", "procesos", ["user_id", "notificado"])
    op.create_index("ix_procesos_user_id_categoria", "procesos", ["user_id", "categoria"])


def downgrade() -> None:
    op.drop_index("ix_procesos_user_id_categoria", table_name="procesos")
    op.drop_index("ix_procesos_user_id_notificado", table_name="procesos")
    op.drop_index("ix_procesos_user_id", table_name="procesos")

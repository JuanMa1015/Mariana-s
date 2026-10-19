"""add dispositivos (tokens push FCM)

Revision ID: e5f1b2c3d4a7
Revises: d4e8a1c6b390
Create Date: 2026-10-19 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f1b2c3d4a7"
down_revision: Union[str, Sequence[str], None] = "d4e8a1c6b390"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dispositivos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(), nullable=False, unique=True),
        sa.Column("plataforma", sa.String(length=10), nullable=False),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("ultimo_uso", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_dispositivos_user_id", "dispositivos", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_dispositivos_user_id", table_name="dispositivos")
    op.drop_table("dispositivos")

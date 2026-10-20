"""panel admin: rol, estado y ultimo acceso en users; tabla audit_log

Revision ID: a7c3d5e9f1b2
Revises: f6b2c3d4e5a8
Create Date: 2026-10-19 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7c3d5e9f1b2"
down_revision: Union[str, Sequence[str], None] = "f6b2c3d4e5a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("ultimo_acceso", sa.DateTime(), nullable=True))
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("admin_email", sa.String(), nullable=False),
        sa.Column("accion", sa.String(length=60), nullable=False),
        sa.Column("objetivo", sa.String(length=200), nullable=True),
        sa.Column("detalle", sa.Text(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_log_creado_en", "audit_log", ["creado_en"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_creado_en", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_column("users", "ultimo_acceso")
    op.drop_column("users", "activo")
    op.drop_column("users", "is_admin")

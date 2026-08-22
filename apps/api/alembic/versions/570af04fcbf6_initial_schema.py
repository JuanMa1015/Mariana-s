"""initial_schema

Revision ID: 570af04fcbf6
Revises: 
Create Date: 2026-06-18 20:34:06.528789

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '570af04fcbf6'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Esquema inicial COMPLETO: crea tambien users y procesos para que
    # 'alembic upgrade head' funcione desde una base de datos vacia.
    # Las columnas que agregan revisiones posteriores (telegram_chat_id,
    # columnas de reintento de notificacion) NO van aqui.
    op.create_table('users',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('username', sa.String(), nullable=True),
    sa.Column('password_hash', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_table('procesos',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('llave_proceso', sa.String(), nullable=False),
    sa.Column('despacho', sa.String(), nullable=True),
    sa.Column('departamento', sa.String(), nullable=True),
    sa.Column('sujetos_procesales', sa.String(), nullable=True),
    sa.Column('tipo_proceso', sa.String(), nullable=True),
    sa.Column('clase_proceso', sa.String(), nullable=True),
    sa.Column('es_privado', sa.Boolean(), nullable=True),
    sa.Column('fecha_proceso', sa.String(), nullable=True),
    sa.Column('fecha_ultima_actuacion', sa.String(), nullable=True),
    sa.Column('notificado', sa.Boolean(), nullable=True),
    sa.Column('tipo_novedad', sa.String(), nullable=True),
    sa.Column('categoria', sa.String(), nullable=True),
    sa.Column('creado_en', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.Column('actualizado_en', sa.DateTime(), nullable=True),
    sa.Column('ultima_sincronizacion', sa.DateTime(), nullable=True),
    sa.Column('dias_sin_cambios', sa.Integer(), nullable=True),
    sa.Column('fallos_consecutivos', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'llave_proceso', name='uix_user_radicado')
    )
    op.create_index(op.f('ix_procesos_llave_proceso'), 'procesos', ['llave_proceso'], unique=False)
    op.create_table('actuaciones',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('proceso_id', sa.Integer(), nullable=False),
    sa.Column('id_reg_actuacion', sa.BigInteger(), nullable=False),
    sa.Column('cons_actuacion', sa.BigInteger(), nullable=False),
    sa.Column('fecha_actuacion', sa.String(), nullable=True),
    sa.Column('actuacion', sa.String(), nullable=True),
    sa.Column('anotacion', sa.Text(), nullable=True),
    sa.Column('fecha_inicial', sa.String(), nullable=True),
    sa.Column('fecha_final', sa.String(), nullable=True),
    sa.Column('fecha_registro', sa.String(), nullable=True),
    sa.Column('cod_regla', sa.String(), nullable=True),
    sa.Column('con_documentos', sa.Boolean(), nullable=True),
    sa.Column('cant', sa.Integer(), nullable=True),
    sa.Column('creado_en', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.ForeignKeyConstraint(['proceso_id'], ['procesos.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('proceso_id', 'id_reg_actuacion', name='uix_proceso_actuacion')
    )
    op.create_index(op.f('ix_actuaciones_id_reg_actuacion'), 'actuaciones', ['id_reg_actuacion'], unique=False)
    op.create_index(op.f('ix_actuaciones_proceso_id'), 'actuaciones', ['proceso_id'], unique=False)
    op.create_table('documentos_actuacion',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('actuacion_id', sa.Integer(), nullable=False),
    sa.Column('id_reg_documento', sa.BigInteger(), nullable=False),
    sa.Column('id_conexion', sa.Integer(), nullable=True),
    sa.Column('cons_actuacion', sa.BigInteger(), nullable=True),
    sa.Column('guid_documento_sxxiw', sa.String(), nullable=True),
    sa.Column('nombre', sa.String(), nullable=False),
    sa.Column('descripcion', sa.Text(), nullable=True),
    sa.Column('tipo', sa.String(), nullable=True),
    sa.Column('fecha_carga', sa.String(), nullable=True),
    sa.Column('creado_en', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.ForeignKeyConstraint(['actuacion_id'], ['actuaciones.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('actuacion_id', 'id_reg_documento', name='uix_actuacion_documento')
    )
    op.create_index(op.f('ix_documentos_actuacion_actuacion_id'), 'documentos_actuacion', ['actuacion_id'], unique=False)
    op.create_index(op.f('ix_documentos_actuacion_id_reg_documento'), 'documentos_actuacion', ['id_reg_documento'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_documentos_actuacion_id_reg_documento'), table_name='documentos_actuacion')
    op.drop_index(op.f('ix_documentos_actuacion_actuacion_id'), table_name='documentos_actuacion')
    op.drop_table('documentos_actuacion')
    op.drop_index(op.f('ix_actuaciones_proceso_id'), table_name='actuaciones')
    op.drop_index(op.f('ix_actuaciones_id_reg_actuacion'), table_name='actuaciones')
    op.drop_table('actuaciones')
    op.drop_index(op.f('ix_procesos_llave_proceso'), table_name='procesos')
    op.drop_table('procesos')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

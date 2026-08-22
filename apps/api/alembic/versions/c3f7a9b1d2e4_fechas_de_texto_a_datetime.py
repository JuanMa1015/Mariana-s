"""fechas de texto a datetime

Convierte las columnas de fecha que estaban como String a DateTime:
- procesos.fecha_proceso, procesos.fecha_ultima_actuacion
- actuaciones.fecha_actuacion, fecha_inicial, fecha_final, fecha_registro
- documentos_actuacion.fecha_carga

Estrategia segura para datos legados:
1. Se normaliza cada valor con el parser tolerante del backend
   (services.fechas.parsear_fecha) al formato canonico
   'YYYY-MM-DD HH:MM:SS.f'. Los valores ilegibles quedan en NULL en lugar
   de romper la conversion en produccion.
2. PostgreSQL: ALTER COLUMN ... TYPE timestamp USING col::timestamp.
   SQLite: sin cambio de DDL; con tipado dinamico, el texto canonico es
   leido/escrito por SQLAlchemy como sa.DateTime sin problema.
"""

import logging

import sqlalchemy as sa
from alembic import op

revision: str = "c3f7a9b1d2e4"
down_revision = "b2c3d4e5f607"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.runtime.migration")

_COLUMNAS = [
    ("procesos", "fecha_proceso"),
    ("procesos", "fecha_ultima_actuacion"),
    ("actuaciones", "fecha_actuacion"),
    ("actuaciones", "fecha_inicial"),
    ("actuaciones", "fecha_final"),
    ("actuaciones", "fecha_registro"),
    ("documentos_actuacion", "fecha_carga"),


]


def _normalizar_datos(bind) -> None:
    from services.fechas import parsear_fecha

    for tabla, columna in _COLUMNAS:
        filas = bind.execute(
            sa.text(f"SELECT id, {columna} FROM {tabla} WHERE {columna} IS NOT NULL")
        ).fetchall()
        convertidas = nulled = 0
        for fila_id, valor in filas:
            dt = parsear_fecha(valor)
            canonico = dt.strftime("%Y-%m-%d %H:%M:%S.%f") if dt is not None else None
            if canonico != valor:
                bind.execute(
                    sa.text(f"UPDATE {tabla} SET {columna} = :valor WHERE id = :fila_id"),
                    {"valor": canonico, "fila_id": fila_id},
                )
                if dt is not None:
                    convertidas += 1
                else:
                    logger.warning(
                        "Valor de fecha ilegible anulado: %s.%s id=%s valor=%r",
                        tabla, columna, fila_id, valor,
                    )
                    nulled += 1
        if convertidas or nulled:
            logger.info("%s.%s: %s normalizadas, %s anuladas", tabla, columna, convertidas, nulled)


def _alterar_tipos(direccion: str) -> None:
    """direccion: 'up' (String->DateTime) o 'down' (DateTime->String).

    Solo PostgreSQL convierte el tipo de columna a timestamp real.

    En SQLite se deja el DDL tal cual: con tipado dinamico basta con que
    los valores queden normalizados ('YYYY-MM-DD HH:MM:SS.f'), que es
    exactamente el formato que el dialecto sqlite de SQLAlchemy escribe y
    lee para sa.DateTime. Recrear la tabla con batch_alter_table NO es
    seguro aqui: alembic copia los datos con CAST y la afinidad NUMERICA
    de 'DATETIME' truncaria '2024-06-10 ...' a 2024.
    """
    dialecto = op.get_bind().dialect.name
    if dialecto != "postgresql":
        return

    por_tabla: dict[str, list[str]] = {}
    for tabla, columna in _COLUMNAS:
        por_tabla.setdefault(tabla, []).append(columna)

    for tabla, columnas in por_tabla.items():
        for columna in columnas:
            if direccion == "up":
                destino, origen = sa.DateTime(), sa.String()
                using = f"{columna}::timestamp"
            else:
                destino, origen = sa.String(), sa.DateTime()
                using = f"{columna}::varchar"
            op.alter_column(tabla, columna, existing_type=origen, type_=destino, postgresql_using=using)


def upgrade() -> None:
    _normalizar_datos(op.get_bind())
    _alterar_tipos("up")


def downgrade() -> None:
    # SQLite: los datos ya quedaron como texto canonico legible por sa.String.
    # PostgreSQL: el USING ::varchar de _alterar_tipos serializa los timestamp.
    _alterar_tipos("down")

#!/usr/bin/env python
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from models import Base  # noqa: E402
from models.proceso import Proceso  # noqa: E402
from models.user import User  # noqa: E402


def build_engine(database_url: str):
    engine_kwargs = {}
    if database_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    else:
        engine_kwargs["pool_pre_ping"] = True
    return create_engine(database_url, **engine_kwargs)


def copy_users(source: Session, target: Session) -> int:
    copied = 0
    for user in source.query(User).order_by(User.id).all():
        target.merge(
            User(
                id=user.id,
                email=user.email,
                password_hash=user.password_hash,
                created_at=user.created_at,
            )
        )
        copied += 1
    return copied


def copy_procesos(source: Session, target: Session) -> int:
    copied = 0
    for proceso in source.query(Proceso).order_by(Proceso.id).all():
        target.merge(
            Proceso(
                id=proceso.id,
                user_id=proceso.user_id,
                llave_proceso=proceso.llave_proceso,
                despacho=proceso.despacho,
                departamento=proceso.departamento,
                sujetos_procesales=proceso.sujetos_procesales,
                tipo_proceso=proceso.tipo_proceso,
                clase_proceso=proceso.clase_proceso,
                es_privado=proceso.es_privado,
                fecha_proceso=proceso.fecha_proceso,
                fecha_ultima_actuacion=proceso.fecha_ultima_actuacion,
                notificado=proceso.notificado,
                creado_en=proceso.creado_en,
                actualizado_en=proceso.actualizado_en,
            )
        )
        copied += 1
    return copied


def reset_sequences(target_engine) -> None:
    if not target_engine.url.drivername.startswith("postgresql"):
        return

    sequence_sql = [
        text(
            "SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), (SELECT COUNT(*) > 0 FROM users))"
        ),
        text(
            "SELECT setval(pg_get_serial_sequence('procesos', 'id'), COALESCE((SELECT MAX(id) FROM procesos), 1), (SELECT COUNT(*) > 0 FROM procesos))"
        ),
    ]
    with target_engine.begin() as connection:
        for statement in sequence_sql:
            connection.execute(statement)


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy SQLite data into PostgreSQL/Neon")
    parser.add_argument(
        "--source",
        default=os.getenv("SOURCE_DATABASE_URL", f"sqlite:///{(ROOT / 'marianas.db').as_posix()}"),
        help="Source database URL. Defaults to the local marianas.db file.",
    )
    parser.add_argument(
        "--target",
        default=os.getenv("TARGET_DATABASE_URL", os.getenv("DATABASE_URL", "")),
        help="Target database URL. Defaults to DATABASE_URL.",
    )
    args = parser.parse_args()

    if not args.target:
        print("ERROR: define DATABASE_URL o usa --target con la URL de Neon/Postgres.", file=sys.stderr)
        return 1

    source_engine = build_engine(args.source)
    target_engine = build_engine(args.target)

    Base.metadata.create_all(bind=target_engine)

    SourceSession = sessionmaker(bind=source_engine)
    TargetSession = sessionmaker(bind=target_engine)

    with SourceSession() as source_session, TargetSession() as target_session:
        users = copy_users(source_session, target_session)
        procesos = copy_procesos(source_session, target_session)
        target_session.commit()

    reset_sequences(target_engine)

    print(f"Migration completed: {users} users and {procesos} procesos copied.")
    print("Target database is ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

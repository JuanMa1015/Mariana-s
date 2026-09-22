---
name: migrar-base-datos
description: Migrate data from the local SQLite database (marianas.db) to Neon/PostgreSQL. Use when asked to "migrar", "exportar", "copiar la base de datos", or to populate a fresh Postgres from local SQLite backups.
---

# Migrar base de datos

Copia datos de SQLite local a Neon/PostgreSQL.

## Script

```powershell
# Desde apps\api
.venv\Scripts\python.exe scripts\migrate_sqlite_to_postgres.py --source "sqlite:///.../marianas.db" --target <DATABASE_URL>
```

## Advertencias

- **Nunca** apuntar `--target` a la base de datos de producción sin permiso
  explícito previo (ver `AGENTS.md`).
- El script copia `users` y `procesos`; **no** copia `actuaciones` ni
  `documentos_actuacion` (se regeneran solos con el sync desde Rama Judicial).
- Fijar `DATABASE_URL` explícito para no tocar producción por error.

## Alternativa: esquema

`init_db()` (en `models/__init__.py`) aplica las migraciones de Alembic al
arrancar; también se puede usar `alembic upgrade head` con `DATABASE_URL`
explícito.

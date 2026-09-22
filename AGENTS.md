# Reglas de trabajo para asistentes/agentes

Reglas acordadas con el dueño del repositorio. NO negociables.

## Git y despliegue

1. **Nunca commitear ni pushear directo a `main`.** Todo trabajo va en una rama
   con nombre descriptivo (`feat/...`, `fix/...`, `chore/...`). El dueño revisa
   y aprueba los Pull Requests desde GitHub.
2. **Nada delicado sin permiso explícito previo**, incluyendo (no limitado a):
   - Push a `main` o merge a `main`
   - Force push o reescritura de historia
   - Migraciones ejecutadas contra la base de datos de producción (Neon)
   - Cambios de variables de entorno o configuración de Render/Vercel
   - Borrado de datos, ramas o archivos en el remoto

## Verificación antes de proponer merge

- Backend: `apps\api\.venv\Scripts\python.exe -m pytest apps\api\tests -q --no-header`
- Frontend (desde `apps\web`): `npm run lint`, `npm run test`, `npm run build`

## Entorno

- Windows PowerShell. El venv del backend vive en `apps/api/.venv`.
- `config.py` hace `load_dotenv()`: al correr alembic/scripts locales, fijar
  siempre `DATABASE_URL` explícito para no apuntar a la BD de producción.

## Contexto del proyecto

Monitor Judicial "Mariana's": monitorea procesos judiciales colombianos
consultando la API pública de la Rama Judicial, detecta nuevas actuaciones y
notifica por correo (Brevo → SendGrid → SMTP) y Telegram.

- **Monorepo**: `apps/api` (FastAPI + SQLAlchemy + PostgreSQL/Neon + Alembic),
  `apps/web` (React 19 + Vite + Tailwind 4), `infra/docker`, `.github/workflows`.
- **Despliegue**: Render (API), Vercel (frontend), Neon (PostgreSQL).
- **URL canónica del frontend**: `https://mariana-app-nu.vercel.app`.
- **Python objetivo**: 3.11 (Dockerfile y CI). El venv local puede ser 3.14,
  pero los locks de dependencias se regeneran con 3.11 (skill `regenerate-deps`).
- El conocimiento detallado (modelo de datos, flujos, gotchas) está en
  [`memory.md`](./memory.md).

## Skills disponibles

Skills funcionales de opencode en `.opencode/skills/`:

- `verify` — correr la verificación completa (tests backend + lint/test/build frontend).
- `regenerate-deps` — regenerar los locks de dependencias con Python 3.11.
- `vincular-telegram` — vincular un chat_id de Telegram a un usuario.
- `migrar-base-datos` — migrar SQLite local a Neon/PostgreSQL.

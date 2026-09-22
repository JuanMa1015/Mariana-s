# Memoria del proyecto — Mariana's Monitor Judicial

Contexto técnico acumulado para que cualquier agente se ponga al día rápido.
Complementa las reglas de [`AGENTS.md`](./AGENTS.md).

## Qué es

Sistema de monitoreo automático de procesos judiciales colombianos. Consulta
periódicamente la base de datos de la Rama Judicial, detecta nuevas
actuaciones y notifica a los usuarios por correo electrónico y Telegram.

## Arquitectura

```
apps/
  api/     Backend FastAPI + SQLAlchemy + PostgreSQL (Neon) + Alembic
  web/     Frontend React 19 + TypeScript + Vite 8 + Tailwind 4
infra/docker/   docker-compose de desarrollo local
docs/api-spec.json
.github/workflows/  sync.yml, verify-deploy.yml, docker-publish.yml
```

## Stack

- **Backend**: FastAPI, Uvicorn, SQLAlchemy 2, psycopg2-binary, Alembic,
  PyJWT, bcrypt, httpx, slowapi (rate limiting), sentry-sdk, sendgrid/brevo.
- **Frontend**: React 19, react-router-dom 7, react-window (lista virtualizada),
  Tailwind CSS 4, Vite 8, Vitest + Testing Library, Sentry, Vercel Analytics.
- **DB**: PostgreSQL (Neon en producción), SQLite para desarrollo/tests locales.
- **Python objetivo**: 3.11 (Dockerfile y CI). Locks generados con 3.11.

## Modelo de datos

- `User` — email, username, password_hash (bcrypt), telegram_chat_id, token_version.
- `Proceso` — llave_proceso (23 dígitos), despacho, departamento, sujetos_procesales,
  tipo/clase, es_privado, categoria, fechas, notificado, dias_sin_cambios,
  fallos_consecutivos, notificacion_pendiente, intentos_notificacion, canales_notificados.
  Único por (user_id, llave_proceso).
- `Actuacion` — id_reg_actuacion (BigInteger), fechas, actuacion, anotacion, con_documentos.
  Único por (proceso_id, id_reg_actuacion).
- `DocumentoActuacion` — id_reg_documento, nombre, tipo, fecha_carga.
  Único por (actuacion_id, id_reg_documento).

## Flujos principales

### Sincronización (`services/sync.py`)
- Disparada por GitHub Actions (`sync.yml`, cron horario) → despierta Render →
  `POST /procesos/sync-lote` (lote de 25), o manual (`POST /procesos/sync`).
- Prioridad de lote: nunca sincronizados → novedades sin revisar → actuaciones
  recientes → más tiempo sin sincronizar.
- 3 consultas en paralelo (`ThreadPoolExecutor`), circuit breaker ante 3 fallos
  consecutivos, reintento intra-ciclo si Rama responde.
- Frecuencia según antigüedad (1/3/7 días) y backoff por fallos de Rama (1/3/7/15 días).
- Cache de respuestas de Rama en disco (`scraper/cache.py`, pickle, TTL 300s).

### Notificaciones (`services/notifications.py` + `email_templates.py`)
- Correo: Brevo (primario, API HTTPS) → SendGrid → SMTP (fallback con 465 SSL).
- Telegram: canal independiente (`services/telegram.py`).
- Una novedad se marca entregada solo si TODOS los canales configurados del
  usuario tuvieron éxito; si falla, queda `notificacion_pendiente` y se reintenta
  con backoff (1/3/6/12/24 h, máx 5 intentos).
- >3 novedades de golpe → correo "resumen" (`template_resumen`).

### Autenticación (`services/auth.py`)
- JWT HS256 en cookie httpOnly `access_token` (SameSite=None; Secure) + token
  "Bearer" opcional. `token_version` revoca todas las sesiones en logout.
- bcrypt, chequeo HIBP (k-anonymity) de contraseñas filtradas, rate limiting slowapi.

## Endpoints clave

- `/health` (con chequeo de BD) y `/healthz` (sin BD, para el keepalive).
- `/procesos/...` — listado paginado, novedades, detalle, add/delete/patch,
  `sync`, `sync-lote`, `sync/estado`, `marcar-todo-leido`, `documento/{id}`.
- `/auth/...` — register, login, logout, me, telegram.
- `/admin/...` — protegidos por `API_TOKEN` (test-email, test-notificacion, resets, telegram).

## Configuración y variables de entorno

- `config.py` hace `load_dotenv()`. Variables: `DATABASE_URL`, `SECRET_KEY` (alias
  `JWT_SECRET`), `API_TOKEN`, `API_URL`, `APP_URL`, `BREVO_API_KEY`, `SENDGRID_API_KEY`,
  `SMTP_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SENTRY_DSN`, `CORS_ORIGINS`,
  `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `RAMA_VERIFY_SSL`, `KEEPALIVE_INTERVAL_SECONDS`.
- `config.py` expone las constantes `APP_URL` y `RAMA_JUDICIAL_URL`.

## Despliegue e infraestructura

- **Render**: API (servicio web, Dockerfile `python:3.11-slim`, auto-deploy desde main).
- **Vercel**: frontend (SPA con rewrites a index.html).
- **Neon**: PostgreSQL serverless (plan free = 100 CU-hours/mes).
- **GitHub Actions**: `sync.yml` (cron horario + wake server + sync-lote),
  `verify-deploy.yml` (comprueba que Render corre el commit exacto),
  `docker-publish.yml` (tests + imágenes GHCR).

## Gotchas y decisiones importantes

1. **Neon CU-hours**: el keepalive del backend debe pegar a `/healthz` (sin BD),
   no a `/health` (que hace `SELECT 1` e impide el autosuspend del compute). El
   frontend también usa `/healthz` para el indicador de conexión (poll 60s).
2. **Python 3.11**: los locks de dependencias se regeneran con 3.11 (skill
   `regenerate-deps`), aunque el venv local sea 3.14.
3. **URL canónica del frontend**: `https://mariana-app-nu.vercel.app` (única
   válida; `marianas.vercel.app` devuelve HTTP 451). Ya normalizada en
   `config.py`, `site.ts`, `index.html`, `sitemap.xml`, `robots.txt` y `.env.example`.
4. **DATABASE_URL explícito**: al correr alembic/scripts locales, fijar
   `DATABASE_URL` para no apuntar a producción.
5. **Fechas**: la Rama envía fechas como texto inconsistente; `services/fechas.py`
   es el único punto que convierte texto → datetime (naive, hora Colombia).
6. **Backups**: `marianas.db` + `*.bak` locales (gitignored) son copias de
   desarrollo; `scripts/migrate_sqlite_to_postgres.py` copia users/procesos.
7. **Cache de Rama**: `scraper/cache.py` usa pickle en `%TEMP%/rama_cache.pkl`.

## Verificación

Ver [`AGENTS.md`](./AGENTS.md) y la skill `verify`.

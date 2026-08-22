# Mariana's - Monitor Judicial

Sistema de monitoreo automatico de procesos judiciales colombianos. Consulta periodicamente la base de datos de la Rama Judicial, detecta nuevas actuaciones y notifica a los usuarios por correo electronico y Telegram.

## Arquitectura

```
apps/
  api/          Backend (FastAPI + PostgreSQL)
  web/          Frontend (React + Vite + Tailwind)
infra/
  docker/       Docker Compose para desarrollo local
scripts/        Scripts de administracion y migracion
```

### Backend (apps/api)

- FastAPI con autenticacion JWT
- SQLAlchemy como ORM con PostgreSQL (Neon)
- Sincronizacion por lotes disparada cada hora desde GitHub Actions (cron) y boton manual en la app
- Cola de prioridad con backoff progresivo ante fallos
- Logging estructurado con request_id
- Prueba de conectividad previa a cada lote de sincronizacion

### Frontend (apps/web)

- React 19 + TypeScript + Vite 8
- Tailwind CSS 4
- Lista virtualizada con react-window para alto rendimiento
- Retry con backoff exponencial en peticiones HTTP

## Requisitos

- Python 3.11+
- Node.js 22+
- PostgreSQL (Neon recomendado para produccion)
- Cuenta en SendGrid (opcional, para correos)
- Bot de Telegram (opcional, para mensajes)

## Configuracion

Copiar `apps/api/.env.example` a `apps/api/.env` y configurar:

| Variable | Descripcion |
|---|---|
| `DATABASE_URL` | Conexion a PostgreSQL |
| `SECRET_KEY` | Clave secreta para tokens JWT (alias retrocompatible: `JWT_SECRET`) |
| `SENDGRID_API_KEY` | API key de SendGrid (opcional) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Fallback SMTP (opcional) |
| `EMAIL_TO` | Correo por defecto para notificaciones |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (opcional) |
| `TELEGRAM_CHAT_ID` | Chat ID por defecto (opcional, se reemplaza por usuario) |

## Desarrollo local

### Backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Para ejecutar los tests instala ademas el lock de desarrollo (incluye runtime + pytest):

```bash
pip install -r requirements-dev.txt
pytest
```

Las dependencias estan fijadas con [pip-tools](https://github.com/jazzband/pip-tools): edita `requirements.in` (o `requirements-dev.in`) y regenera el lock correspondiente:

```bash
pip install pip-tools
pip-compile requirements.in -o requirements.txt          # solo runtime
pip-compile requirements-dev.in -o requirements-dev.txt  # runtime + tests
```

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

### Docker

```bash
docker compose -f infra/docker/docker-compose.yml up --build -d
```

## Sincronizacion

El sistema consulta la Rama Judicial en lotes de 25 radicados por ciclo, cada 1 hora, disparado por el workflow `sync.yml` de GitHub Actions (que despierta el servidor y llama a `/procesos/sync-lote`). Tambien puedes sincronizar manualmente con el boton "Sincronizar" de la app. La frecuencia de sincronizacion de cada radicado se ajusta segun su antiguedad.

Ante fallos consecutivos de Rama Judicial, cada radicado aplica backoff progresivo (1, 3, 7 y 15 dias) antes de reintentar automaticamente; un envio exitoso reinicia el contador.

## Canales de notificacion

- **Correo electronico**: SendGrid con fallback a SMTP directo. Plantillas HTML profesionales con soporte para clientes de correo.
- **Telegram**: Bot que envia mensajes con el mismo contenido del correo. Cada usuario registra su propio chat_id.

Una novedad solo se marca como entregada cuando TODOS los canales configurados del usuario tuvieron exito; si el correo falla, la novedad queda pendiente y se reintenta con backoff (1, 3, 6, 12 y 24 horas, maximo 5 intentos).

### Diagnostico de correos que no llegan

1. Verifica la config con el endpoint admin: `curl -H "Authorization: Bearer $API_TOKEN" "$API_URL/test-email"`.
2. En SendGrid, revisa que `EMAIL_FROM` (o `SMTP_USER`) sea un **Sender Identity verificado**; si no, SendGrid rechaza cada envio con 403.
3. Revisa spam/promociones: con IP compartida de SendGrid es habitual.
4. El plan gratuito de SendGrid limita a 100 correos/dia.
5. Los logs de Render muestran `SendGrid -> ... | status=...` por envio, y un error explicito si falta `SENDGRID_API_KEY`.

## Vinculacion de Telegram

Para conectar un usuario a Telegram:

```bash
# Listar quienes han escrito al bot
python apps/api/scripts/vincular_telegram.py listar

# Vincular chat_id a un usuario
python apps/api/scripts/vincular_telegram.py vincular <chat_id> <email>
```

## Despliegue

- Backend: Render (servicio web desde GitHub)
- Frontend: Vercel (desde GitHub)
- Base de datos: Neon (PostgreSQL serverless)

Ambos servicios se actualizan automaticamente al hacer push a la rama main.

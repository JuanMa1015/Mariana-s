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
- Sincronizacion programada con APScheduler (cada 1 hora)
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
| `JWT_SECRET` | Clave secreta para tokens JWT |
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

El sistema consulta la Rama Judicial en lotes de 25 radicados por ciclo, cada 1 hora. La frecuencia de sincronizacion de cada radicado se ajusta segun su antiguedad.

Ante fallos consecutivos, el sistema aplica backoff progresivo (1, 3, 7, 15 dias) antes de reintentar automaticamente.

## Canales de notificacion

- **Correo electronico**: SendGrid con fallback a SMTP directo. Plantillas HTML profesionales con soporte para clientes de correo.
- **Telegram**: Bot que envia mensajes con el mismo contenido del correo. Cada usuario registra su propio chat_id.

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

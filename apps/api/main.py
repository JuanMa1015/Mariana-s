import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from models import init_db
from services.scheduler import iniciar_scheduler
from routers.procesos import router as procesos_router
from routers.auth import router as auth_router

logger = logging.getLogger(__name__)



@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = iniciar_scheduler(intervalo_horas=6)
    yield
    scheduler.shutdown()

app = FastAPI(title="Mariana's - Monitor Judicial", lifespan=lifespan)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no manejado en %s: %s", request.url, exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"{type(exc).__name__}: {exc}",
            "error": str(exc),
            "type": type(exc).__name__,
        },
        headers={
            "Access-Control-Allow-Origin": "https://mariana-app-nu.vercel.app",
            "Access-Control-Allow-Credentials": "true",
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cors_fallback(request: Request, call_next):
    response = await call_next(request)
    if "access-control-allow-origin" not in response.headers:
        response.headers["Access-Control-Allow-Origin"] = "*"
    if "access-control-allow-headers" not in response.headers:
        response.headers["Access-Control-Allow-Headers"] = "*"
    if "access-control-allow-methods" not in response.headers:
        response.headers["Access-Control-Allow-Methods"] = "*"
    return response

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/test-email")
def test_email():
    import json, urllib.request
    from config import EMAIL_TO, SENDGRID_API_KEY

    destinatarios = [c.strip() for c in EMAIL_TO.replace(",", " ").split() if c.strip()]
    if not destinatarios:
        return {"email_enviado": False, "error": "Sin destinatarios"}

    data = json.dumps({
        "personalizations": [{"to": [{"email": d} for d in destinatarios]}],
        "from": {"email": "gonzalezjuanmanuel645@gmail.com"},
        "subject": "TEST - Mariana's",
        "content": [{"type": "text/plain", "value": "Correo de prueba desde Mariana's."}],
    }).encode()

    req = urllib.request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=data,
        headers={
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode()
            return {
                "email_enviado": True,
                "status": resp.status,
                "body": body[:200],
                "destinatario": EMAIL_TO,
                "sendgrid_api_key_set": bool(SENDGRID_API_KEY),
            }
    except urllib.error.HTTPError as e:
        return {
            "email_enviado": False,
            "status": e.code,
            "body": e.read().decode()[:500],
            "destinatario": EMAIL_TO,
            "sendgrid_api_key_set": bool(SENDGRID_API_KEY),
        }
    except Exception as exc:
        return {
            "email_enviado": False,
            "error": repr(exc),
            "destinatario": EMAIL_TO,
            "sendgrid_api_key_set": bool(SENDGRID_API_KEY),
        }

app.include_router(auth_router)
app.include_router(procesos_router)
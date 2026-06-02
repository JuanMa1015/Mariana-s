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
    from services.notifications import notificar_cambio_radicado
    from config import EMAIL_TO, SMTP_HOST
    ok = notificar_cambio_radicado(
        llave_proceso="TEST-123456789012345678901",
        despacho="TEST Despacho",
        departamento="TEST",
        fecha_ultima_actuacion="2026-06-01",
        sujetos_procesales="Test de notificación",
        actuacion="TEST Actuación",
        anotacion="Mensaje de prueba desde Mariana's",
        fecha_registro="2026-06-01T12:00:00",
        con_documentos=False,
    )
    return {"email_enviado": ok, "destinatario": EMAIL_TO, "smtp_host": SMTP_HOST}

app.include_router(auth_router)
app.include_router(procesos_router)
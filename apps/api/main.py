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
    import socket, smtplib
    from email.message import EmailMessage
    from config import EMAIL_FROM, EMAIL_TO, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USE_TLS, SMTP_USER, APP_URL

    destinatarios = [c.strip() for c in EMAIL_TO.replace(",", " ").split() if c.strip()]
    if not SMTP_HOST or not destinatarios:
        return {"email_enviado": False, "error": "SMTP no configurado", "smtp_host": SMTP_HOST, "destinatario": EMAIL_TO}

    # Test DNS resolution
    try:
        ips = socket.getaddrinfo(SMTP_HOST, SMTP_PORT)
        dns_ok = ips[:2]
    except Exception as e:
        dns_ok = f"DNS fail: {e}"

    mensaje = EmailMessage()
    mensaje["From"] = EMAIL_FROM or SMTP_USER
    mensaje["To"] = ", ".join(destinatarios)
    mensaje["Subject"] = "TEST - Mariana's Monitor Judicial"
    mensaje.set_content("Este es un correo de prueba desde Mariana's.\n\nSi recibes esto, las notificaciones funcionan correctamente.")

    # Try port 587 (STARTTLS)
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(mensaje, to_addrs=destinatarios)
        return {"email_enviado": True, "destinatario": EMAIL_TO, "smtp_host": SMTP_HOST, "puerto": SMTP_PORT, "smtp_user": SMTP_USER, "dns": str(dns_ok)}
    except Exception as exc:
        pass

    # Try port 465 (SSL directo)
    try:
        with smtplib.SMTP_SSL(SMTP_HOST, 465, timeout=15) as server:
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(mensaje, to_addrs=destinatarios)
        return {"email_enviado": True, "destinatario": EMAIL_TO, "smtp_host": SMTP_HOST, "puerto": 465, "smtp_user": SMTP_USER, "dns": str(dns_ok)}
    except Exception as exc:
        return {"email_enviado": False, "destinatario": EMAIL_TO, "smtp_host": SMTP_HOST, "smtp_user": SMTP_USER, "dns": str(dns_ok), "error": repr(exc)}

app.include_router(auth_router)
app.include_router(procesos_router)
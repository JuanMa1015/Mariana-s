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
    import socket
    from config import EMAIL_TO, SMTP_HOST, SMTP_USER, SMTP_PASSWORD

    # Solo DNS + ping básico, nada de SMTP para evitar timeouts
    result = {"destinatario": EMAIL_TO, "smtp_host": SMTP_HOST, "smtp_user": SMTP_USER}

    try:
        ips = socket.getaddrinfo(SMTP_HOST, 587)
        result["dns"] = [f"{info[0]}:{info[4][0]}" for info in ips[:3]]
    except Exception as e:
        result["dns"] = f"DNS fail: {e}"
        return {"email_enviado": False, **result}

    # Intentar conexión TCP rápida
    for puerto in [587, 465]:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((SMTP_HOST, puerto))
            sock.close()
            result["tcp_ok"] = puerto
            break
        except Exception as e:
            result[f"tcp_{puerto}"] = str(e)

    if "tcp_ok" in result:
        # TCP conectó, intentar SMTP
        import smtplib
        from email.message import EmailMessage
        from config import EMAIL_FROM

        mensaje = EmailMessage()
        mensaje["From"] = EMAIL_FROM or SMTP_USER
        mensaje["To"] = EMAIL_TO
        mensaje["Subject"] = "TEST - Mariana's Monitor Judicial"
        mensaje.set_content("Correo de prueba desde Mariana's.")

        puerto = result["tcp_ok"]
        try:
            if puerto == 465:
                with smtplib.SMTP_SSL(SMTP_HOST, 465, timeout=10) as server:
                    if SMTP_USER:
                        server.login(SMTP_USER, SMTP_PASSWORD)
                    server.send_message(mensaje)
            else:
                with smtplib.SMTP(SMTP_HOST, puerto, timeout=10) as server:
                    server.starttls()
                    if SMTP_USER:
                        server.login(SMTP_USER, SMTP_PASSWORD)
                    server.send_message(mensaje)
            return {"email_enviado": True, **result}
        except Exception as e:
            return {"email_enviado": False, "smtp_error": repr(e), **result}

    return {"email_enviado": False, **result}

app.include_router(auth_router)
app.include_router(procesos_router)
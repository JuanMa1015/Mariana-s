import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.middleware import SlowAPIMiddleware
from services.limiter import limiter
from slowapi.errors import RateLimitExceeded
from models import init_db
from services.keepalive import Keepalive
from services.logging_config import configurar_logging, set_request_id, get_request_id
from routers.procesos import router as procesos_router
from routers.auth import router as auth_router
from routers.admin import router as admin_router
from config import SENTRY_DSN, CORS_ORIGINS

if SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,
    )

configurar_logging()
logger = logging.getLogger(__name__)



@asynccontextmanager
async def lifespan(app: FastAPI):
    import time as _time

    for intento in range(3):
        try:
            init_db()
            break
        except Exception as exc:
            logger.warning("Intento %d/3 de conexion a BD fallo: %s", intento + 1, exc)
            if intento < 2:
                _time.sleep(2 ** intento)
            else:
                logger.error("No se pudo conectar a la BD tras 3 intentos. Continuando...")
    keepalive = Keepalive()
    keepalive.iniciar()
    yield
    keepalive.detener()

app = FastAPI(title="Mariana's - Monitor Judicial", lifespan=lifespan)
app.state.limiter = limiter


def _cors_headers_para(origin: str) -> dict:
    """Headers CORS para respuestas de error, tolerando CORS_ORIGINS vacio."""
    permitido = origin if origin in CORS_ORIGINS else (CORS_ORIGINS[0] if CORS_ORIGINS else None)
    if not permitido:
        return {}
    return {
        "Access-Control-Allow-Origin": permitido,
        "Access-Control-Allow-Credentials": "true",
    }


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Demasiadas solicitudes. Intenta de nuevo en un minuto."},
        headers=_cors_headers_para(request.headers.get("origin", "")),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no manejado en %s: %s", request.url, exc)
    if isinstance(exc, HTTPException):
        detail = exc.detail
        status_code = exc.status_code
    else:
        detail = "Error interno del servidor"
        status_code = 500
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail},
        headers=_cors_headers_para(request.headers.get("origin", "")),
    )


from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    if "x-content-type-options" not in response.headers:
        response.headers["X-Content-Type-Options"] = "nosniff"
    if "x-frame-options" not in response.headers:
        response.headers["X-Frame-Options"] = "DENY"
    if "x-xss-protection" not in response.headers:
        response.headers["X-XSS-Protection"] = "1; mode=block"
    if "referrer-policy" not in response.headers:
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("X-Request-Id", "")
    set_request_id(rid)
    logger.info("→ %s %s", request.method, request.url.path)
    response = await call_next(request)
    response.headers["X-Request-Id"] = get_request_id()
    return response

@app.middleware("http")
async def csrf_origin_middleware(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        auth_header = request.headers.get("authorization", "")
        is_bearer = auth_header.lower().startswith("bearer ")
        origin = request.headers.get("origin", "")
        if not is_bearer and origin and origin not in CORS_ORIGINS:
            return JSONResponse(
                status_code=403,
                content={"detail": "Origen no permitido"},
                headers={"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"},
            )
    return await call_next(request)


@app.get("/health")
def health(deep: bool = False):
    """Health check ligero (solo BD) para polls frecuentes.

    Con ?deep=true incluye ademas un check real contra Rama Judicial
    (puede tardar varios segundos; usar con moderacion).
    """
    from models.database import SessionLocal
    from sqlalchemy import text

    db_ok = False
    db_error = None
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db_ok = True
        db.close()
    except Exception as exc:
        db_error = f"{type(exc).__name__}: {exc}"

    payload = {
        "status": "ok" if db_ok else "degradado",
        "version": os.environ.get("RENDER_GIT_COMMIT", "").lower() or "dev",
        "base_de_datos": {"ok": db_ok, "error": db_error},
        # El sync por lotes se dispara externamente (GitHub Actions, cron horario)
        "sync_disparador": "github-actions",
    }
    if deep:
        from scraper.rama_client import rama_health_check

        payload["rama_judicial"] = {"ok": rama_health_check()}
    return payload


app.include_router(auth_router)
app.include_router(procesos_router)
app.include_router(admin_router)
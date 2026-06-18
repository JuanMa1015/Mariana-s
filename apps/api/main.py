import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from models import init_db
from services.scheduler import iniciar_scheduler, obtener_estado_scheduler
from services.keepalive import Keepalive
from services.logging_config import configurar_logging, set_request_id, get_request_id
from routers.procesos import router as procesos_router
from routers.auth import router as auth_router

configurar_logging()
logger = logging.getLogger(__name__)



@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = iniciar_scheduler(intervalo_horas=1)
    keepalive = Keepalive()
    keepalive.iniciar()
    yield
    keepalive.detener()
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
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("X-Request-Id", "")
    set_request_id(rid)
    logger.info("→ %s %s", request.method, request.url.path)
    response = await call_next(request)
    response.headers["X-Request-Id"] = get_request_id()
    return response


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
    from models.database import SessionLocal
    from sqlalchemy import text
    from scraper.rama_client import rama_health_check

    db_ok = False
    db_error = None
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db_ok = True
        db.close()
    except Exception as exc:
        db_error = f"{type(exc).__name__}: {exc}"

    rama_ok = rama_health_check()
    scheduler = obtener_estado_scheduler()

    return {
        "status": "ok" if db_ok else "degradado",
        "base_de_datos": {"ok": db_ok, "error": db_error},
        "rama_judicial": {"ok": rama_ok},
        "scheduler": scheduler,
    }


@app.get("/test-notificacion")
def test_notificacion(llave_proceso: str = ""):
    from models.database import SessionLocal
    from models.actuacion import Actuacion
    from models.proceso import Proceso
    from services.notifications import notificar_cambio_radicado

    db = SessionLocal()
    try:
        query = db.query(Proceso)
        if llave_proceso:
            query = query.filter(Proceso.llave_proceso == llave_proceso)
        proceso = query.order_by(Proceso.id.desc()).first()
        if not proceso:
            return {"error": "No hay procesos en la DB"}

        ultima = (
            db.query(Actuacion)
            .filter(Actuacion.proceso_id == proceso.id)
            .order_by(Actuacion.fecha_actuacion.desc().nullslast(), Actuacion.id_reg_actuacion.desc())
            .first()
        )
        ok = notificar_cambio_radicado(
            llave_proceso=proceso.llave_proceso,
            despacho=proceso.despacho or "",
            departamento=proceso.departamento or "",
            fecha_ultima_actuacion=proceso.fecha_ultima_actuacion,
            sujetos_procesales=proceso.sujetos_procesales or "",
            actuacion=ultima.actuacion if ultima else None,
            anotacion=ultima.anotacion if ultima else None,
            fecha_registro=ultima.fecha_registro if ultima else None,
            con_documentos=ultima.con_documentos if ultima else False,
            categoria=proceso.categoria,
        )
        return {"email_enviado": ok, "radicado": proceso.llave_proceso, "actuacion": ultima.actuacion if ultima else "N/A"}
    finally:
        db.close()


@app.get("/marcar-leido")
def marcar_leido(llave_proceso: str):
    from models.database import SessionLocal
    from models.proceso import Proceso

    db = SessionLocal()
    try:
        proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso).first()
        if not proceso:
            return {"ok": False, "error": "No encontrado"}
        proceso.notificado = True
        db.commit()
        return {"ok": True, "llave_proceso": llave_proceso}
    finally:
        db.close()


@app.get("/resetear-radicado")
def resetear_radicado(llave_proceso: str):
    from models.database import SessionLocal
    from models.actuacion import Actuacion
    from models.documento_actuacion import DocumentoActuacion
    from models.proceso import Proceso

    db = SessionLocal()
    try:
        proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso).first()
        if not proceso:
            return {"ok": False, "error": "No encontrado"}
        docs = db.query(DocumentoActuacion).join(Actuacion).filter(Actuacion.proceso_id == proceso.id).all()
        for d in docs:
            db.delete(d)
        acts = db.query(Actuacion).filter(Actuacion.proceso_id == proceso.id).all()
        for a in acts:
            db.delete(a)
        proceso.notificado = True
        proceso.fecha_ultima_actuacion = None
        db.commit()
        return {"ok": True, "llave_proceso": llave_proceso, "actuaciones_borradas": len(acts), "documentos_borrados": len(docs)}
    finally:
        db.close()


@app.post("/resetear-todos")
def resetear_todos():
    from models.database import SessionLocal
    from models.actuacion import Actuacion
    from models.documento_actuacion import DocumentoActuacion
    from models.proceso import Proceso

    db = SessionLocal()
    try:
        procesos = db.query(Proceso).all()
        total_acts = 0
        total_docs = 0
        for proceso in procesos:
            docs = db.query(DocumentoActuacion).join(Actuacion).filter(Actuacion.proceso_id == proceso.id).all()
            for d in docs:
                db.delete(d)
            total_docs += len(docs)
            acts = db.query(Actuacion).filter(Actuacion.proceso_id == proceso.id).all()
            for a in acts:
                db.delete(a)
            total_acts += len(acts)
            proceso.notificado = True
            proceso.tipo_novedad = "nuevo"
            proceso.fecha_ultima_actuacion = None
        db.commit()
        return {
            "ok": True,
            "total_radicados": len(procesos),
            "actuaciones_borradas": total_acts,
            "documentos_borrados": total_docs,
        }
    finally:
        db.close()


@app.get("/test-email")
def test_email():
    from config import EMAIL_TO as CFG_EMAIL_TO, SENDGRID_API_KEY, SMTP_HOST
    from services.notifications import _enviar_smtp, _enviar_sendgrid

    destinatarios = [c.strip() for c in CFG_EMAIL_TO.replace(",", " ").split() if c.strip()]
    if not destinatarios:
        return {"email_enviado": False, "error": "Sin destinatarios"}

    asunto = "TEST - Mariana's"
    cuerpo = "Correo de prueba desde Mariana's."
    resultados = {}

    if SENDGRID_API_KEY:
        sg_ok = _enviar_sendgrid(destinatarios, asunto, cuerpo)
        resultados["sendgrid"] = {"ok": sg_ok, "api_key_set": True}
    else:
        resultados["sendgrid"] = {"ok": False, "api_key_set": False}

    if SMTP_HOST:
        smtp_ok = _enviar_smtp(destinatarios, asunto, cuerpo)
        resultados["smtp"] = {"ok": smtp_ok}
    else:
        resultados["smtp"] = {"ok": False, "smtp_host_set": False}

    primary_ok = resultados.get("sendgrid", {}).get("ok", False) or resultados.get("smtp", {}).get("ok", False)
    return {
        "resultados": resultados,
        "email_enviado": primary_ok,
        "destinatarios": destinatarios,
    }

app.include_router(auth_router)
app.include_router(procesos_router)
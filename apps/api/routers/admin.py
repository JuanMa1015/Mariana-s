import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import httpx
from config import API_TOKEN, TELEGRAM_BOT_TOKEN
from models.actuacion import Actuacion
from models.database import get_db
from models.documento_actuacion import DocumentoActuacion
from models.proceso import Proceso
from models.user import User
from services.limiter import limiter

router = APIRouter(tags=["admin"])

logger = logging.getLogger(__name__)


def requiere_api_token(request: Request):
    """Dependencia compartida por todos los endpoints de administracion/debug.

    Acepta unicamente Authorization: Bearer <API_TOKEN>. Si API_TOKEN no esta
    configurado se deshabilitan por completo (503) en lugar de quedar abiertos.
    """
    if not API_TOKEN:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="API_TOKEN no configurado")
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer ") and secrets.compare_digest(
        auth_header.split(" ", 1)[1].encode("utf-8"), API_TOKEN.encode("utf-8")
    ):
        return None
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


@router.get("/test-notificacion")
@limiter.limit("60/minute")
def test_notificacion(
    request: Request,
    llave_proceso: str = "",
    db: Session = Depends(get_db),
    _: None = Depends(requiere_api_token),
):
    from models.actuacion import Actuacion as ActuacionModel
    from services.notifications import notificar_cambio_radicado

    query = db.query(Proceso)
    if llave_proceso:
        query = query.filter(Proceso.llave_proceso == llave_proceso)
    proceso = query.order_by(Proceso.id.desc()).first()
    if not proceso:
        return {"error": "No hay procesos en la DB"}

    ultima = (
        db.query(ActuacionModel)
        .filter(ActuacionModel.proceso_id == proceso.id)
        .order_by(ActuacionModel.fecha_actuacion.desc().nullslast(), ActuacionModel.id_reg_actuacion.desc())
        .first()
    )
    res = notificar_cambio_radicado(
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
    return {
        "email_enviado": res.get("email"),
        "telegram_enviado": res.get("telegram"),
        "radicado": proceso.llave_proceso,
        "actuacion": ultima.actuacion if ultima else "N/A",
    }


@router.get("/marcar-leido")
@limiter.limit("60/minute")
def marcar_leido(request: Request, llave_proceso: str, db: Session = Depends(get_db), _: None = Depends(requiere_api_token)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso).first()
    if not proceso:
        return {"ok": False, "error": "No encontrado"}
    proceso.notificado = True
    db.commit()
    return {"ok": True, "llave_proceso": llave_proceso}


@router.get("/resetear-radicado")
@limiter.limit("60/minute")
def resetear_radicado(request: Request, llave_proceso: str, db: Session = Depends(get_db), _: None = Depends(requiere_api_token)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso).first()
    if not proceso:
        return {"ok": False, "error": "No encontrado"}

    # Borrados en lote (un DELETE con subconsulta en vez de fila a fila)
    ids_actuaciones = db.query(Actuacion.id).filter(Actuacion.proceso_id == proceso.id)
    docs_borrados = (
        db.query(DocumentoActuacion)
        .filter(DocumentoActuacion.actuacion_id.in_(ids_actuaciones))
        .delete(synchronize_session=False)
    )
    acts_borradas = (
        db.query(Actuacion)
        .filter(Actuacion.proceso_id == proceso.id)
        .delete(synchronize_session=False)
    )
    proceso.notificado = True
    proceso.fecha_ultima_actuacion = None
    db.commit()
    return {
        "ok": True,
        "llave_proceso": llave_proceso,
        "actuaciones_borradas": acts_borradas or 0,
        "documentos_borrados": docs_borrados or 0,
    }


@router.post("/resetear-todos")
@limiter.limit("60/minute")
def resetear_todos(request: Request, db: Session = Depends(get_db), _: None = Depends(requiere_api_token)):
    total_radicados = (
        db.query(Proceso)
        .update(
            {
                Proceso.notificado: True,
                Proceso.tipo_novedad: "nuevo",
                Proceso.fecha_ultima_actuacion: None,
            },
            synchronize_session=False,
        )
    )
    total_docs = db.query(DocumentoActuacion).delete(synchronize_session=False)
    total_acts = db.query(Actuacion).delete(synchronize_session=False)
    db.commit()
    return {
        "ok": True,
        "total_radicados": total_radicados or 0,
        "actuaciones_borradas": total_acts or 0,
        "documentos_borrados": total_docs or 0,
    }


@router.get("/test-email")
@limiter.limit("60/minute")
def test_email(request: Request, _: None = Depends(requiere_api_token)):
    from config import EMAIL_TO as CFG_EMAIL_TO, SENDGRID_API_KEY, SMTP_HOST
    from services.notifications import _enviar_smtp, _enviar_sendgrid

    destinatarios = [c.strip() for c in CFG_EMAIL_TO.replace(",", " ").split() if c.strip()]
    if not destinatarios:
        return {"email_enviado": False, "error": "Sin destinatarios"}

    asunto = "TEST - Mariana's"
    cuerpo_html = "<p>Correo de prueba desde Mariana's.</p>"
    cuerpo_texto = "Correo de prueba desde Mariana's."
    resultados = {}

    if SENDGRID_API_KEY:
        sg_ok = _enviar_sendgrid(destinatarios, asunto, cuerpo_html, cuerpo_texto)
        resultados["sendgrid"] = {"ok": sg_ok, "api_key_set": True}
    else:
        resultados["sendgrid"] = {"ok": False, "api_key_set": False}

    if SMTP_HOST:
        smtp_ok = _enviar_smtp(destinatarios, asunto, cuerpo_html, cuerpo_texto)
        resultados["smtp"] = {"ok": smtp_ok}
    else:
        resultados["smtp"] = {"ok": False, "smtp_host_set": False}

    primary_ok = resultados.get("sendgrid", {}).get("ok", False) or resultados.get("smtp", {}).get("ok", False)
    return {
        "resultados": resultados,
        "email_enviado": primary_ok,
        "destinatarios": destinatarios,
    }


@router.get("/admin/telegram-listar")
@limiter.limit("60/minute")
def admin_telegram_listar(request: Request, _: None = Depends(requiere_api_token), test: str = ""):
    if not TELEGRAM_BOT_TOKEN:
        return {"error": "TELEGRAM_BOT_TOKEN no configurado"}

    if test:
        # Validar antes de convertir a int para no devolver 500 con basura
        if not test.lstrip("-").isdigit():
            return {"ok": False, "error": "chat_id invalido"}
        texto = "ESTO ES UNA PRUEBA - SAPA. No es un cambio real en tus radicados. Si recibes esto, significa que las notificaciones por Telegram te estan llegando correctamente."
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        resp = httpx.post(url, json={"chat_id": int(test), "text": texto}, timeout=10)
        return {"ok": resp.json().get("ok", False), "chat_id": int(test)}

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    resp = httpx.get(url, timeout=10)
    data = resp.json()
    if not data.get("ok") or not data.get("result"):
        return {"usuarios": []}
    vistos = set()
    usuarios = []
    for update in data["result"]:
        msg = update.get("message", {})
        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        first_name = chat.get("first_name", "")
        username = chat.get("username", "")
        text = msg.get("text", "")
        if chat_id and chat_id not in vistos:
            vistos.add(chat_id)
            usuarios.append({"chat_id": chat_id, "nombre": first_name, "user": username or "", "ultimo_mensaje": text or ""})
    return {"usuarios": usuarios}


class VincularTelegramPayload(BaseModel):
    chat_id: str
    email: str


@router.post("/admin/telegram-vincular")
@limiter.limit("60/minute")
def admin_telegram_vincular(
    request: Request,
    payload: VincularTelegramPayload,
    db: Session = Depends(get_db),
    _: None = Depends(requiere_api_token),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"ok": False, "error": "Usuario no encontrado"}
    user.telegram_chat_id = payload.chat_id
    db.commit()
    return {"ok": True, "chat_id": payload.chat_id, "email": payload.email}

import logging

import httpx

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)

API_BASE = "https://api.telegram.org/bot"


def _mensaje_texto(
    llave_proceso: str,
    despacho: str,
    departamento: str,
    fecha_ultima_actuacion: str | None,
    actuacion: str | None = None,
    anotacion: str | None = None,
    categoria: str | None = None,
    sujetos_procesales: str = "",
    fecha_registro: str | None = None,
    con_documentos: bool | None = None,
    actuaciones: list[dict] | None = None,
) -> str:
    partes = [p.strip() for p in (sujetos_procesales or "").split("|") if p.strip()]
    sujetos = "\n".join(f"> `{p}`" for p in partes) if partes else "> Sin informacion"

    if actuaciones:
        lines = []
        for i, act in enumerate(actuaciones):
            label = ">> " if i == 0 else "   "
            docs = "Si" if act.get("con_documentos") else "No"
            lines.append(
                f"{label}{(act.get('fecha_actuacion') or 'N/D')[:10]} — {act.get('actuacion') or 'N/D'}\n"
                f"   Anotacion: {act.get('anotacion') or 'N/D'}\n"
                f"   Registro: {(act.get('fecha_registro') or 'N/D')[:10]} | Docs: {docs}"
            )
        actuaciones_texto = "\n\n".join(lines)
    else:
        docs = "Si" if con_documentos else "No"
        actuaciones_texto = (
            f"*Actuacion:* {actuacion or 'N/D'}\n"
            f"*Anotacion:* {anotacion or 'N/D'}\n"
            f"*Fecha registro:* {fecha_registro or 'N/D'}\n"
            f"*Documentos:* {docs}"
        )

    return (
        f"*Novedad judicial - {categoria or 'General'}*\n"
        f"\n"
        f"`{llave_proceso}`\n"
        f"{despacho or '-'} | {departamento or '-'}\n"
        f"Ultima actuacion: {fecha_ultima_actuacion or 'N/D'}\n"
        f"\n"
        f"{actuaciones_texto}\n"
        f"\n"
        f"{sujetos}"
    )


def notificar_telegram(
    llave_proceso: str,
    despacho: str,
    departamento: str,
    fecha_ultima_actuacion: str | None,
    sujetos_procesales: str = "",
    actuacion: str | None = None,
    anotacion: str | None = None,
    fecha_registro: str | None = None,
    con_documentos: bool | None = None,
    categoria: str | None = None,
    custom_mensaje: str | None = None,
    chat_id: str | None = None,
    actuaciones: list[dict] | None = None,
) -> bool:
    chat_id = chat_id or TELEGRAM_CHAT_ID
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        logger.info("Telegram no configurado (falta TELEGRAM_BOT_TOKEN o chat_id)")
        return False

    texto = custom_mensaje or _mensaje_texto(
        llave_proceso=llave_proceso,
        despacho=despacho,
        departamento=departamento,
        fecha_ultima_actuacion=fecha_ultima_actuacion,
        actuacion=actuacion,
        anotacion=anotacion,
        categoria=categoria,
        sujetos_procesales=sujetos_procesales,
        fecha_registro=fecha_registro,
        con_documentos=con_documentos,
        actuaciones=actuaciones,
    )

    url = f"{API_BASE}{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": texto,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }

    try:
        with httpx.Client(timeout=15) as client:
            response = client.post(url, json=payload)
            ok = response.status_code == 200
            if ok:
                logger.info("Telegram -> chat %s | ok", chat_id)
            else:
                logger.warning("Telegram falló: %s | %s", response.status_code, response.text[:200])
            return ok
    except Exception as exc:
        logger.error("Telegram error: %s", exc)
        return False

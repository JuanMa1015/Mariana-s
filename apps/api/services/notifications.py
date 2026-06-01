import logging
import smtplib
import re
from email.message import EmailMessage

from config import EMAIL_FROM, EMAIL_TO, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USE_TLS, SMTP_USER, APP_URL

logger = logging.getLogger(__name__)


def notificar_cambio_radicado(
    llave_proceso: str,
    despacho: str,
    departamento: str,
    fecha_ultima_actuacion: str | None,
    sujetos_procesales: str,
    actuacion: str | None = None,
    anotacion: str | None = None,
    fecha_registro: str | None = None,
    con_documentos: bool | None = None,
    num_actuaciones: int | None = None,
    total_actualizadas: int | None = None,
) -> bool:
    destinatarios = [correo.strip() for correo in re.split(r"[\s,]+", EMAIL_TO) if correo.strip()]

    if not SMTP_HOST or not destinatarios:
        logger.info("Correo no configurado; se omite notificación para %s", llave_proceso)
        return False

    asunto = f"Novedad judicial: {llave_proceso}"
    cuerpo = (
        f"╔══════════════════════════════════════════╗\n"
        f"║  MARIANA'S — MONITOR JUDICIAL            ║\n"
        f"╚══════════════════════════════════════════╝\n\n"
        f"Se detectó una nueva actuación en el proceso:\n\n"
        f"  Radicado:     {llave_proceso}\n"
        f"  Despacho:     {despacho}\n"
        f"  Departamento: {departamento}\n"
        f"  Última act.:  {fecha_ultima_actuacion or 'N/D'}\n\n"
        f"── Nueva actuación ──\n"
        f"  Actuación:    {actuacion or 'N/D'}\n"
        f"  Anotación:    {anotacion or 'N/D'}\n"
        f"  Fecha registro: {fecha_registro or 'N/D'}\n"
        f"  Documentos:   {'Sí' if con_documentos else 'No'}\n\n"
        f"  Sujetos procesales:\n"
        f"  {sujetos_procesales}\n"
        f"\n"
        f"──────────\n"
        f"  Ver en Rama Judicial:\n"
        f"  https://consultaprocesos.ramajudicial.gov.co/procesos/bienvenida\n"
        f"\n"
        f"  Ver en Mariana's:\n"
        f"  {APP_URL}\n"
    )
    if total_actualizadas is not None:
        asunto = f"[{total_actualizadas} novedades] {asunto}"

    mensaje = EmailMessage()
    mensaje["From"] = EMAIL_FROM
    mensaje["To"] = ", ".join(destinatarios)
    mensaje["Subject"] = asunto
    mensaje.set_content(cuerpo)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(mensaje, to_addrs=destinatarios)
        logger.info("Notificación enviada para radicado %s", llave_proceso)
        return True
    except Exception as exc:
        logger.error("No se pudo enviar correo para %s: %s", llave_proceso, exc)
        return False
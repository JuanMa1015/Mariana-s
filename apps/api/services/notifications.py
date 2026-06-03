import logging
import smtplib
import re
from email.message import EmailMessage

from config import EMAIL_FROM, EMAIL_TO, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USE_TLS, SMTP_USER, APP_URL, SENDGRID_API_KEY

logger = logging.getLogger(__name__)


def _enviar_sendgrid(destinatarios: list[str], asunto: str, cuerpo: str) -> bool:
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content

        message = Mail(
            from_email=Email(EMAIL_FROM or SMTP_USER or "noreply@mariana.app"),
            to_emails=[To(c) for c in destinatarios],
            subject=asunto,
            plain_text_content=Content("text/plain", cuerpo),
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info("SendGrid response status: %s", response.status_code)
        return 200 <= response.status_code < 300
    except Exception as exc:
        logger.error("SendGrid falló: %s", exc)
        return False


def _enviar_smtp(destinatarios: list[str], asunto: str, cuerpo: str) -> bool:
    if not SMTP_HOST:
        return False

    mensaje = EmailMessage()
    mensaje["From"] = EMAIL_FROM or SMTP_USER
    mensaje["To"] = ", ".join(destinatarios)
    mensaje["Subject"] = asunto
    mensaje.set_content(cuerpo)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(mensaje)
        logger.info("SMTP enviado correctamente")
        return True
    except Exception as exc:
        logger.error("SMTP falló: %s", exc)
        return False


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
    destinatarios: list[str] | None = None,
) -> bool:
    if not destinatarios:
        destinatarios = [correo.strip() for correo in re.split(r"[\s,]+", EMAIL_TO) if correo.strip()]

    if not destinatarios:
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

    # Intentar SendGrid primero, luego SMTP
    if SENDGRID_API_KEY:
        return _enviar_sendgrid(destinatarios, asunto, cuerpo)

    return _enviar_smtp(destinatarios, asunto, cuerpo)

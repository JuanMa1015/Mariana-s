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

        for dest in destinatarios:
            message = Mail(
                from_email=Email(EMAIL_FROM or SMTP_USER or "noreply@mariana.app"),
                to_emails=To(dest),
                subject=asunto,
                plain_text_content=Content("text/plain", cuerpo),
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            response = sg.send(message)
            ok = 200 <= response.status_code < 300
            logger.info(
                "SendGrid -> %s | status=%s | ok=%s",
                dest, response.status_code, ok,
            )
            if not ok:
                return False
        return True
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
    categoria: str | None = None,
) -> bool:
    if not destinatarios:
        destinatarios = [correo.strip() for correo in re.split(r"[\s,]+", EMAIL_TO) if correo.strip()]

    if not destinatarios:
        logger.info("Correo no configurado; se omite notificación para %s", llave_proceso)
        return False

    asunto = f"Novedad judicial: {llave_proceso}"
    cuerpo = (
        f"MARIANA'S — Monitor Judicial\n\n"
        f"Se detectó una nueva actuación en el proceso:\n\n"
        f"  Radicado:     {llave_proceso}\n"
        f"  Categoría:    {categoria or 'General'}\n"
        f"  Despacho:     {despacho}\n"
        f"  Departamento: {departamento}\n"
        f"  Última act.:  {fecha_ultima_actuacion or 'N/D'}\n\n"
        f"Nueva actuación:\n"
        f"  Actuación:    {actuacion or 'N/D'}\n"
        f"  Anotación:    {anotacion or 'N/D'}\n"
        f"  Fecha registro: {fecha_registro or 'N/D'}\n"
        f"  Documentos:   {'Sí' if con_documentos else 'No'}\n\n"
        f"Sujetos procesales:\n"
        f"  {sujetos_procesales}\n"
        f"\n"
        f"---\n"
        f"Ver en Mariana's: {APP_URL}\n"
    )
    if total_actualizadas is not None and total_actualizadas > 0:
        asunto = f"[{total_actualizadas} novedades] {asunto}"

    default_destinatarios = [correo.strip() for correo in re.split(r"[\s,]+", EMAIL_TO) if correo.strip()]
    using_defaults = set(destinatarios) == set(default_destinatarios)

    exito = False
    if SENDGRID_API_KEY:
        exito = _enviar_sendgrid(destinatarios, asunto, cuerpo)

    if not exito and SMTP_HOST:
        logger.warning("SendGrid falló, reintentando con SMTP para %s", destinatarios)
        exito = _enviar_smtp(destinatarios, asunto, cuerpo)

    if not exito and not using_defaults and default_destinatarios:
        logger.warning(
            "Fallo envío a %s, reintentando con destinatarios por defecto: %s",
            destinatarios, default_destinatarios,
        )
        if SENDGRID_API_KEY:
            exito = _enviar_sendgrid(default_destinatarios, asunto, cuerpo)
        if not exito and SMTP_HOST:
            exito = _enviar_smtp(default_destinatarios, asunto, cuerpo)

    return exito

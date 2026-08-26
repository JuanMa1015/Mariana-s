import logging
import smtplib
import re
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import EMAIL_FROM, EMAIL_TO, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USE_TLS, SMTP_USER, APP_URL, SENDGRID_API_KEY
from services.fechas import fecha_corta

logger = logging.getLogger(__name__)


def _enviar_sendgrid(destinatarios: list[str], asunto: str, cuerpo_html: str, cuerpo_texto: str) -> tuple[bool, str | None]:
    """Envia via SendGrid. Retorna (ok, detalle_del_error)."""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content

        for dest in destinatarios:
            message = Mail(
                from_email=Email(EMAIL_FROM or SMTP_USER or "noreply@mariana.app"),
                to_emails=To(dest),
                subject=asunto,
                plain_text_content=Content("text/plain", cuerpo_texto),
                html_content=Content("text/html", cuerpo_html),
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            response = sg.send(message)
            ok = 200 <= response.status_code < 300
            logger.info(
                "SendGrid -> %s | status=%s | ok=%s",
                dest, response.status_code, ok,
            )
            if not ok:
                cuerpo = getattr(response, "body", b"") or b""
                return False, f"HTTP {response.status_code}: {cuerpo[:200]}"
        return True, None
    except Exception as exc:
        logger.error("SendGrid falló: %s", exc)
        return False, f"{type(exc).__name__}: {exc}"


def _enviar_smtp(destinatarios: list[str], asunto: str, cuerpo_html: str, cuerpo_texto: str) -> tuple[bool, str | None]:
    """Envia via SMTP. Retorna (ok, detalle_del_error)."""
    if not SMTP_HOST:
        return False, "SMTP_HOST no configurado"

    mensaje = MIMEMultipart("alternative")
    mensaje["From"] = EMAIL_FROM or SMTP_USER
    mensaje["To"] = ", ".join(destinatarios)
    mensaje["Subject"] = asunto
    mensaje.attach(MIMEText(cuerpo_texto, "plain"))
    mensaje.attach(MIMEText(cuerpo_html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(mensaje)
        logger.info("SMTP enviado correctamente")
        return True, None
    except Exception as exc:
        logger.error("SMTP falló: %s", exc)
        return False, f"{type(exc).__name__}: {exc}"


def notificar_cambio_radicado(
    llave_proceso: str,
    despacho: str,
    departamento: str,
    fecha_ultima_actuacion,
    sujetos_procesales: str,
    actuacion: str | None = None,
    anotacion: str | None = None,
    fecha_registro=None,
    con_documentos: bool | None = None,
    categoria: str | None = None,
    destinatarios: list[str] | None = None,
    custom_asunto: str | None = None,
    custom_cuerpo: str | None = None,
    telegram_chat_id: str | None = None,
    actuaciones: list[dict] | None = None,
) -> dict:
    if not destinatarios:
        destinatarios = [correo.strip() for correo in re.split(r"[\s,]+", EMAIL_TO) if correo.strip()]

    exito = False
    if destinatarios:
        from services.email_templates import template_novedad

        if custom_asunto and custom_cuerpo:
            asunto = custom_asunto
            cuerpo_html = custom_cuerpo
            cuerpo_texto = re.sub(r"<[^>]+>", "", custom_cuerpo).strip()
        else:
            asunto = f"Novedad judicial: {llave_proceso}"
            cuerpo_html = template_novedad(
                llave_proceso=llave_proceso,
                despacho=despacho,
                departamento=departamento,
                fecha_ultima_actuacion=fecha_ultima_actuacion,
                sujetos_procesales=sujetos_procesales,
                actuacion=actuacion,
                anotacion=anotacion,
                fecha_registro=fecha_registro,
                con_documentos=con_documentos,
                categoria=categoria,
                actuaciones=actuaciones,
            )
            partes_sujetos = [p.strip() for p in (sujetos_procesales or "").split("|") if p.strip()]
            sujetos_texto = "\n".join(f"  {p}" for p in partes_sujetos) or "  Sin informacion"
            link_rama = f"https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion?numero={llave_proceso}"
            if actuaciones:
                lines = []
                for act in actuaciones:
                    lines.append(f"  - {fecha_corta(act.get('fecha_actuacion'))}: {act.get('actuacion','N/D')}")
                actuaciones_texto = "\n".join(lines)
            else:
                actuaciones_texto = f"  Actuacion: {actuacion or 'N/D'}\n  Anotacion: {anotacion or 'N/D'}\n  Fecha registro: {fecha_corta(fecha_registro)}\n  Documentos: {'Si' if con_documentos else 'No'}"
            cuerpo_texto = (
                f"MARIANA'S — Monitor Judicial\n\n"
                f"Se detectaron nuevas actuaciones en el proceso:\n\n"
                f"  Radicado:     {llave_proceso}\n"
                f"  Categoria:    {categoria or 'General'}\n"
                f"  Despacho:     {despacho}\n"
                f"  Departamento: {departamento}\n"
                f"  Ultima act.:  {fecha_corta(fecha_ultima_actuacion)}\n\n"
                f"Nuevas actuaciones:\n"
                f"{actuaciones_texto}\n\n"
                f"Sujetos procesales:\n"
                f"{sujetos_texto}\n"
                f"\n"
                f"---\n"
                f"Consultar en Rama Judicial: {link_rama}\n"
                f"Ver en Mariana's: {APP_URL}\n"
            )

        if SENDGRID_API_KEY:
            exito, _detalle_sg = _enviar_sendgrid(destinatarios, asunto, cuerpo_html, cuerpo_texto)

        if not exito and SMTP_HOST:
            logger.warning("SendGrid falló, reintentando con SMTP para %s", destinatarios)
            exito, _detalle_smtp = _enviar_smtp(destinatarios, asunto, cuerpo_html, cuerpo_texto)

        if not exito and not SENDGRID_API_KEY and not SMTP_HOST:
            logger.error(
                "Email para %s NO enviado: ni SENDGRID_API_KEY ni SMTP_HOST estan "
                "configurados en el entorno (Telegram funciona de forma independiente).",
                llave_proceso,
            )

        # Nota: si el envio falla NO se reenvia a los destinatarios por defecto
        # (EMAIL_TO): la novedad queda como pendiente y se reintenta despues
        # para el destinatario original. Nunca se filtran datos de un usuario
        # a otro buzón.
    else:
        logger.info("Correo no configurado; se omite email para %s", llave_proceso)

    # Telegram como canal independiente del email
    telegram_ok = False
    from services.telegram import notificar_telegram
    try:
        telegram_ok = notificar_telegram(
            llave_proceso=llave_proceso,
            despacho=despacho,
            departamento=departamento,
            fecha_ultima_actuacion=fecha_ultima_actuacion,
            sujetos_procesales=sujetos_procesales,
            actuacion=actuacion,
            anotacion=anotacion,
            categoria=categoria,
            chat_id=telegram_chat_id,
            actuaciones=actuaciones,
        )
    except Exception as exc:
        logger.error("Telegram falló en notificar_cambio_radicado: %s", exc)

    return {"email": exito, "telegram": telegram_ok}

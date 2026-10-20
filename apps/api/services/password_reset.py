"""Restablecimiento de contraseña con token de un solo uso enviado por correo.

El token es aleatorio (32 bytes), solo se guarda su hash SHA-256 y vence a los
PASSWORD_RESET_MINUTES. Viaja en el fragmento (#) del enlace para que no llegue
a logs de servidores ni al encabezado Referer.
"""
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from config import APP_URL, PASSWORD_RESET_MINUTES
from models.password_reset import PasswordReset
from models.user import User
from services.auth import get_password_hash, password_en_filtraciones
from services.email_restablecer import template_restablecer
from services.notifications import enviar_correo

logger = logging.getLogger(__name__)

# Evita que alguien dispare correos en rafaga a una misma cuenta
ESPERA_ENTRE_ENVIOS_SEGUNDOS = 60


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def enviar_enlace(db: Session, user: User) -> str:
    """Genera un token nuevo (invalida los anteriores) y envia el correo.

    Retorna "enviado", "espera" (hubo un envio hace menos de un minuto) o "error" (fallo el correo).
    """
    reciente = (
        db.query(PasswordReset)
        .filter(PasswordReset.user_id == user.id, PasswordReset.usado_en.is_(None))
        .order_by(PasswordReset.id.desc())
        .first()
    )
    if reciente and reciente.creado_en and (_ahora() - reciente.creado_en).total_seconds() < ESPERA_ENTRE_ENVIOS_SEGUNDOS:
        return "espera"

    db.query(PasswordReset).filter(PasswordReset.user_id == user.id, PasswordReset.usado_en.is_(None)).delete(
        synchronize_session=False
    )
    token = secrets.token_urlsafe(32)
    db.add(PasswordReset(user_id=user.id, token_hash=_hash(token), expira_en=_ahora() + timedelta(minutes=PASSWORD_RESET_MINUTES)))
    db.commit()

    enlace = f"{APP_URL.rstrip('/')}/restablecer#token={token}"
    html, texto = template_restablecer(user.username or user.email.split("@")[0], enlace, PASSWORD_RESET_MINUTES)
    ok = enviar_correo([user.email], "Restablece tu contraseña de Mariana's", html, texto)
    return "enviado" if ok else "error"


class TokenInvalido(Exception):
    """Token inexistente, vencido o ya usado."""


class PasswordInsegura(Exception):
    """La contraseña es corta o aparece en filtraciones conocidas."""


def restablecer(db: Session, token: str, nueva_password: str) -> None:
    if len(nueva_password) < 8:
        raise PasswordInsegura("La contraseña debe tener al menos 8 caracteres")
    registro = db.query(PasswordReset).filter(PasswordReset.token_hash == _hash(token)).first()
    if not registro or registro.usado_en is not None or registro.expira_en < _ahora():
        raise TokenInvalido()
    if password_en_filtraciones(nueva_password):
        raise PasswordInsegura("Esta contraseña aparece en filtraciones conocidas. Elige una diferente.")

    user = db.get(User, registro.user_id)
    if not user:
        raise TokenInvalido()
    user.password_hash = get_password_hash(nueva_password)
    # Cierra todas las sesiones abiertas (cookies y Bearer emitidos antes)
    user.token_version = (user.token_version or 0) + 1
    registro.usado_en = _ahora()
    db.query(PasswordReset).filter(PasswordReset.user_id == user.id, PasswordReset.usado_en.is_(None)).delete(
        synchronize_session=False
    )
    db.commit()

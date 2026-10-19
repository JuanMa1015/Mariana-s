"""Notificaciones push a la app movil via Firebase Cloud Messaging (HTTP v1).

Canal opcional y "best effort": si FCM_SERVICE_ACCOUNT_JSON no esta configurado,
no hace nada. Nunca interviene en la logica de entrega/reintento de correo y
Telegram. Autentica con una cuenta de servicio firmando un JWT (PyJWT +
cryptography, ya son dependencias) para no sumar librerias de Google.
"""
import json
import logging
import threading
import time

import httpx
import jwt

from config import FCM_SERVICE_ACCOUNT_JSON

logger = logging.getLogger(__name__)

_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_TOKEN_URI_DEFAULT = "https://oauth2.googleapis.com/token"
CANAL_ANDROID = "novedades"  # debe coincidir con el canal creado en la app

_lock = threading.Lock()
_acceso: dict = {"token": None, "exp": 0.0}


def _cuenta() -> dict | None:
    if not FCM_SERVICE_ACCOUNT_JSON:
        return None
    try:
        cuenta = json.loads(FCM_SERVICE_ACCOUNT_JSON)
        return cuenta if cuenta.get("private_key") and cuenta.get("client_email") and cuenta.get("project_id") else None
    except ValueError:
        logger.error("FCM_SERVICE_ACCOUNT_JSON no es un JSON valido; push desactivado.")
        return None


def habilitado() -> bool:
    return _cuenta() is not None


def _token_acceso(cuenta: dict) -> str:
    ahora = time.time()
    with _lock:
        if _acceso["token"] and _acceso["exp"] - 60 > ahora:
            return _acceso["token"]
        token_uri = cuenta.get("token_uri") or _TOKEN_URI_DEFAULT
        asercion = jwt.encode(
            {"iss": cuenta["client_email"], "scope": _SCOPE, "aud": token_uri, "iat": int(ahora), "exp": int(ahora) + 3600},
            cuenta["private_key"],
            algorithm="RS256",
        )
        r = httpx.post(
            token_uri,
            data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": asercion},
            timeout=10,
        )
        r.raise_for_status()
        datos = r.json()
        _acceso["token"] = datos["access_token"]
        _acceso["exp"] = ahora + int(datos.get("expires_in", 3600))
        return _acceso["token"]


def _mensaje(token: str, titulo: str, cuerpo: str, llave: str | None) -> dict:
    return {
        "message": {
            "token": token,
            "notification": {"title": titulo, "body": cuerpo},
            # La app abre el detalle del proceso al tocar el aviso
            "data": {"llave_proceso": llave or ""},
            "android": {"priority": "HIGH", "notification": {"channel_id": CANAL_ANDROID}},
        }
    }


def enviar_a_tokens(tokens: list[str], titulo: str, cuerpo: str, llave: str | None = None) -> list[str]:
    """Envia el aviso a cada token. Retorna los tokens que FCM reporta como invalidos (a borrar)."""
    cuenta = _cuenta()
    if not cuenta or not tokens:
        return []
    invalidos: list[str] = []
    try:
        acceso = _token_acceso(cuenta)
    except Exception as exc:
        logger.error("Push: no se pudo autenticar con FCM: %s", exc)
        return []
    url = f"https://fcm.googleapis.com/v1/projects/{cuenta['project_id']}/messages:send"
    for token in tokens:
        try:
            r = httpx.post(url, json=_mensaje(token, titulo, cuerpo, llave), headers={"Authorization": f"Bearer {acceso}"}, timeout=10)
        except httpx.HTTPError as exc:
            logger.warning("Push: error de red enviando a FCM: %s", exc)
            continue
        if r.status_code == 404 or (r.status_code == 400 and "UNREGISTERED" in r.text):
            invalidos.append(token)
        elif r.status_code >= 400:
            logger.warning("Push: FCM respondio %s: %s", r.status_code, r.text[:200])
    return invalidos


def notificar_usuario(user_id: int, titulo: str, cuerpo: str, llave: str | None = None) -> int:
    """Envia un push a todos los dispositivos del usuario y limpia los tokens invalidos.

    Nunca lanza: un fallo de push no debe afectar la sincronizacion.
    """
    if not habilitado():
        return 0
    from models.database import SessionLocal
    from models.dispositivo import Dispositivo

    db = SessionLocal()
    try:
        tokens = [d.token for d in db.query(Dispositivo).filter(Dispositivo.user_id == user_id).all()]
        if not tokens:
            return 0
        invalidos = enviar_a_tokens(tokens, titulo, cuerpo, llave)
        if invalidos:
            db.query(Dispositivo).filter(Dispositivo.token.in_(invalidos)).delete(synchronize_session=False)
            db.commit()
        return len(tokens) - len(invalidos)
    except Exception as exc:
        logger.error("Push: fallo notificando al usuario %s: %s", user_id, exc)
        return 0
    finally:
        db.close()

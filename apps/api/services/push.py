"""Notificaciones push a la app movil via Firebase Cloud Messaging (HTTP v1).

Canal opcional y "best effort": si FCM_SERVICE_ACCOUNT_JSON no esta configurado,
no hace nada. Nunca interviene en la logica de entrega/reintento de correo y
Telegram. Autentica con una cuenta de servicio firmando un JWT (PyJWT +
cryptography, ya son dependencias) para no sumar librerias de Google.
"""
import json
import logging
import re
import threading
import time
from dataclasses import dataclass, field

import httpx
import jwt

from config import FCM_SERVICE_ACCOUNT_JSON
from services.fechas import parsear_fecha

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


def _mensaje(token: str, titulo: str, cuerpo: str, llave: str | None, tag: str | None = None) -> dict:
    # `tag` hace que un aviso nuevo del mismo proceso reemplace al anterior en la bandeja en vez de apilarse
    noti = {"channel_id": CANAL_ANDROID, **({"tag": tag} if tag else {})}
    return {
        "message": {
            "token": token,
            "notification": {"title": titulo, "body": cuerpo},
            # La app abre el detalle del proceso al tocar el aviso
            "data": {"llave_proceso": llave or ""},
            "android": {"priority": "HIGH", "notification": noti},
        }
    }


# ── Contenido del aviso ────────────────────────────────────────────────────
_MESES = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")


def radicado_legible(llave: str | None) -> str:
    """05001310301720240048000 -> 05001 31 03 017 2024 00480 00"""
    return re.sub(r"^(\d{5})(\d{2})(\d{2})(\d{3})(\d{4})(\d{5})(\d{2})$", r"\1 \2 \3 \4 \5 \6 \7", llave or "")


def _recorte(texto, limite: int) -> str:
    t = " ".join(str(texto or "").split())
    return t if len(t) <= limite else t[: limite - 1].rstrip() + "…"


def _fecha_legible(valor) -> str:
    d = parsear_fecha(valor)
    return f"{d.day} {_MESES[d.month - 1]} {d.year}" if d else ""


def armar_aviso(n: dict, prueba: bool = False) -> tuple[str, str]:
    """Titulo y cuerpo del aviso de UN proceso con lo que el abogado necesita al primer vistazo.

    Plegado se ven el titulo y la primera linea (el radicado); al expandirlo, el resto:
    actuacion, despacho, anotacion y fecha. `n` es el dict de la novedad (ver services.sync).
    """
    acts = n.get("actuaciones") or []
    ultima = acts[-1] if acts else {}  # las nuevas llegan en orden cronologico: la ultima es la mas reciente
    alias = _recorte(n.get("alias"), 40)
    titulo = ("[Prueba] " if prueba else "") + "Nueva actuación" + (f" · {alias}" if alias else "")
    lineas = [radicado_legible(n.get("llave_proceso")), _recorte(ultima.get("actuacion"), 120) or "Hay una actuación nueva"]
    if n.get("despacho"):
        lineas.append(_recorte(n["despacho"], 80))
    anotacion = _recorte(ultima.get("anotacion"), 160)
    if anotacion:
        lineas.append(f"Anotación: {anotacion}")
    extras = [_fecha_legible(ultima.get("fecha_actuacion"))]
    if ultima.get("con_documentos"):
        extras.append("con documentos")
    if len(acts) > 1:
        extras.append(f"+{len(acts) - 1} más")
    extras = [e for e in extras if e]
    if extras:
        lineas.append(" · ".join(extras))
    return titulo, "\n".join(lineas)


def armar_resumen(notifs: list[dict]) -> tuple[str, str]:
    """Aviso unico cuando hay varias novedades a la vez (evita llenar la bandeja de avisos)."""
    titulo = f"{len(notifs)} procesos con novedades"
    lineas = []
    for n in notifs[:5]:
        alias = _recorte(n.get("alias"), 30)
        lineas.append(f"• {radicado_legible(n.get('llave_proceso'))}" + (f" · {alias}" if alias else ""))
    if len(notifs) > 5:
        lineas.append(f"y {len(notifs) - 5} más")
    return titulo, "\n".join(lineas)


def ejemplo_de_aviso(db, user_id: int) -> tuple[str, str, str | None]:
    """Aviso simulado con los datos reales del proceso mas reciente del usuario (para ver como queda en el celular)."""
    from datetime import datetime

    from models.proceso import Proceso

    p = (
        db.query(Proceso)
        .filter(Proceso.user_id == user_id)
        .order_by(Proceso.fecha_ultima_actuacion.desc().nullslast(), Proceso.id)
        .first()
    )
    n = {
        "llave_proceso": p.llave_proceso if p else "05001310301720240048000",
        "alias": p.alias if p else None,
        "despacho": (p.despacho if p and p.despacho else "Juzgado 12 Civil del Circuito de Medellín"),
        "actuaciones": [{
            "actuacion": "Auto que fija fecha de audiencia",
            "anotacion": "Se fija audiencia inicial (aviso simulado: no es una novedad real)",
            "fecha_actuacion": datetime.now(),
            "con_documentos": True,
        }],
    }
    titulo, cuerpo = armar_aviso(n, prueba=True)
    return titulo, cuerpo, n["llave_proceso"] if p else None


@dataclass
class ResultadoPush:
    """Lo que realmente paso al enviar: cuantos celulares, cuantos aceptó FCM y por qué falló el resto."""

    dispositivos: int = 0
    aceptados: int = 0
    tokens_invalidos: list[str] = field(default_factory=list)  # caducados: FCM responde 404/UNREGISTERED
    errores: list[str] = field(default_factory=list)  # sin tokens, aptos para mostrar al admin


def enviar_a_tokens(tokens: list[str], titulo: str, cuerpo: str, llave: str | None = None, tag: str | None = None) -> ResultadoPush:
    """Envia el aviso a cada token y cuenta solo lo que FCM acepta (HTTP 2xx)."""
    res = ResultadoPush(dispositivos=len(tokens))
    cuenta = _cuenta()
    if not cuenta or not tokens:
        return res
    try:
        acceso = _token_acceso(cuenta)
    except Exception as exc:
        logger.error("Push: no se pudo autenticar con FCM: %s", exc)
        res.errores.append(f"autenticación con Google: {str(exc)[:120]}")
        return res
    url = f"https://fcm.googleapis.com/v1/projects/{cuenta['project_id']}/messages:send"
    for token in tokens:
        try:
            r = httpx.post(url, json=_mensaje(token, titulo, cuerpo, llave, tag), headers={"Authorization": f"Bearer {acceso}"}, timeout=10)
        except httpx.HTTPError as exc:
            logger.warning("Push: error de red enviando a FCM: %s", exc)
            res.errores.append(f"red: {str(exc)[:100]}")
            continue
        if 200 <= r.status_code < 300:
            res.aceptados += 1
        elif r.status_code == 404 or (r.status_code == 400 and "UNREGISTERED" in r.text):
            res.tokens_invalidos.append(token)
        else:
            logger.warning("Push: FCM respondio %s: %s", r.status_code, r.text[:200])
            res.errores.append(f"FCM {r.status_code}: {r.text[:120]}")
    return res


def notificar_usuario_detalle(user_id: int, titulo: str, cuerpo: str, llave: str | None = None, tag: str | None = None) -> ResultadoPush:
    """Envia un push a todos los celulares del usuario y limpia los tokens caducados.

    Nunca lanza: un fallo de push no debe afectar la sincronizacion. Deja una linea de log por envio
    (usuario, celulares, aceptados) para poder reconstruir despues por que un aviso no llego.
    """
    if not habilitado():
        return ResultadoPush(errores=["push no configurado en el servidor"])
    from models.database import SessionLocal
    from models.dispositivo import Dispositivo

    db = SessionLocal()
    try:
        tokens = [d.token for d in db.query(Dispositivo).filter(Dispositivo.user_id == user_id).all()]
        if not tokens:
            logger.info("Push: usuario %s sin celulares registrados; no se envia", user_id)
            return ResultadoPush()
        res = enviar_a_tokens(tokens, titulo, cuerpo, llave, tag)
        if res.tokens_invalidos:
            db.query(Dispositivo).filter(Dispositivo.token.in_(res.tokens_invalidos)).delete(synchronize_session=False)
            db.commit()
        logger.info(
            "Push: usuario %s -> %d celular(es), %d aceptado(s), %d caducado(s) borrado(s), errores=%s",
            user_id, res.dispositivos, res.aceptados, len(res.tokens_invalidos), res.errores or "ninguno",
        )
        return res
    except Exception as exc:
        logger.error("Push: fallo notificando al usuario %s: %s", user_id, exc)
        return ResultadoPush(errores=[f"error interno: {str(exc)[:100]}"])
    finally:
        db.close()


def notificar_usuario(user_id: int, titulo: str, cuerpo: str, llave: str | None = None, tag: str | None = None) -> int:
    """Como `notificar_usuario_detalle`, pero devuelve solo cuantos celulares aceptaron el aviso."""
    return notificar_usuario_detalle(user_id, titulo, cuerpo, llave, tag).aceptados

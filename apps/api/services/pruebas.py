"""Pruebas de diagnostico del panel de administracion.

Cada prueba ejercita el sistema real (base de datos, flujos de la API, correo, push, Telegram, Rama
Judicial) y devuelve una lista de pasos con su resultado. Las que necesitan datos crean un usuario
temporal `qa-*@example.com` y lo borran siempre al terminar. Las llamadas a la API van por un cliente
interno (sin red) con una IP distinta por ejecucion para no gastar el limite de intentos de nadie.
"""
import os
import re
import secrets
import threading
import time
from contextlib import contextmanager
from unittest.mock import patch

import httpx
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from config import (
    ADMIN_EMAILS,
    API_TOKEN,
    APP_URL,
    BREVO_API_KEY,
    CORS_ORIGINS,
    FCM_SERVICE_ACCOUNT_JSON,
    SECRET_KEY,
    SENDGRID_API_KEY,
    SMTP_HOST,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
)
from models.dispositivo import Dispositivo
from models.proceso import Proceso
from models.user import User
from services.auth import create_access_token, get_password_hash

RADICADO_EJEMPLO = "05001310301720240048000"


class Pasos:
    """Acumula el resultado de cada comprobacion de una prueba."""

    def __init__(self) -> None:
        self.items: list[dict] = []

    def _add(self, estado: str, nombre: str, detalle: str = "") -> bool:
        self.items.append({"estado": estado, "nombre": nombre, "detalle": detalle})
        return estado == "ok"

    def ok(self, nombre: str, detalle: str = "") -> bool:
        return self._add("ok", nombre, detalle)

    def aviso(self, nombre: str, detalle: str = "") -> bool:
        return self._add("aviso", nombre, detalle)

    def fallo(self, nombre: str, detalle: str = "") -> bool:
        return self._add("fallo", nombre, detalle)

    def verificar(self, condicion: bool, nombre: str, detalle_ok: str = "", detalle_fallo: str = "") -> bool:
        return self.ok(nombre, detalle_ok) if condicion else self.fallo(nombre, detalle_fallo)

    @property
    def estado(self) -> str:
        estados = {i["estado"] for i in self.items}
        return "fallo" if "fallo" in estados else "aviso" if "aviso" in estados else "ok"


def _cliente():
    """Cliente interno de la API (sin red). Sin `with`: no ejecuta el arranque de la app."""
    from starlette.testclient import TestClient

    from main import app

    ip = f"10.{secrets.randbelow(250) + 1}.{secrets.randbelow(250) + 1}.{secrets.randbelow(250) + 1}"
    return TestClient(app, raise_server_exceptions=False, headers={"X-Forwarded-For": ip})


def _borrar_usuario_por_email(db: Session, email: str) -> None:
    from routers.panel_admin import _borrar_usuario

    db.rollback()
    db.expire_all()
    u = db.query(User).filter(func.lower(User.email) == email.lower()).first()
    if u:
        _borrar_usuario(db, u)


@contextmanager
def usuario_temporal(db: Session):
    """Crea un usuario de prueba y lo borra (con todo lo suyo) al salir, pase lo que pase."""
    sufijo = secrets.token_hex(4)
    password = f"Qa-{secrets.token_urlsafe(12)}-9"
    u = User(email=f"qa-{sufijo}@example.com", username=f"qa_{sufijo}", password_hash=get_password_hash(password))
    db.add(u)
    db.commit()
    db.refresh(u)
    try:
        yield u, password
    finally:
        _borrar_usuario_por_email(db, f"qa-{sufijo}@example.com")


def _bearer(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(data={'sub': user.email, 'ver': user.token_version})}"}


def _ms(inicio: float) -> int:
    return int((time.perf_counter() - inicio) * 1000)


# ── Pruebas ────────────────────────────────────────────────────────────────
def prueba_bd(db: Session, admin: User, p: dict) -> Pasos:
    r = Pasos()
    t = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        r.ok("Conexión a la base de datos", f"{_ms(t)} ms · {db.bind.dialect.name}")
    except Exception as exc:
        r.fallo("Conexión a la base de datos", str(exc))
        return r
    try:
        from alembic.config import Config
        from alembic.runtime.migration import MigrationContext
        from alembic.script import ScriptDirectory

        actual = MigrationContext.configure(db.connection()).get_current_revision()
        cabeza = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
        r.verificar(actual == cabeza, "Migraciones al día", f"revisión {actual}", f"la base está en {actual} y el código espera {cabeza}")
    except Exception as exc:
        r.aviso("Migraciones", f"no se pudo comparar: {exc}")
    from models.actuacion import Actuacion

    conteos = {
        "usuarios": db.query(func.count(User.id)).scalar(),
        "procesos": db.query(func.count(Proceso.id)).scalar(),
        "actuaciones": db.query(func.count(Actuacion.id_reg_actuacion)).scalar(),
        "dispositivos": db.query(func.count(Dispositivo.id)).scalar(),
    }
    r.ok("Lectura de tablas", " · ".join(f"{k}: {v}" for k, v in conteos.items()))
    return r


def prueba_configuracion(db: Session, admin: User, p: dict) -> Pasos:
    from services import push

    r = Pasos()
    r.verificar(bool(os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET")) and len(SECRET_KEY) >= 32, "Clave de sesiones (SECRET_KEY)", "configurada", "falta o es corta (mín. 32 caracteres)")
    r.ok("API_TOKEN (workflows)", "configurado") if API_TOKEN else r.aviso("API_TOKEN (workflows)", "no configurado: los endpoints de sincronización por CI quedan deshabilitados")
    r.ok("Correo", ", ".join(n for n, v in (("Brevo", BREVO_API_KEY), ("SendGrid", SENDGRID_API_KEY), ("SMTP", SMTP_HOST)) if v) or "") if (BREVO_API_KEY or SENDGRID_API_KEY or SMTP_HOST) else r.fallo("Correo", "ningún proveedor configurado (BREVO_API_KEY, SENDGRID_API_KEY o SMTP_HOST)")
    r.ok("Telegram", "bot configurado") if TELEGRAM_BOT_TOKEN else r.aviso("Telegram", "sin TELEGRAM_BOT_TOKEN: no se envían avisos por Telegram")
    if FCM_SERVICE_ACCOUNT_JSON:
        r.verificar(push.habilitado(), "Notificaciones push (FCM)", "cuenta de servicio válida", "FCM_SERVICE_ACCOUNT_JSON no es un JSON válido")
    else:
        r.aviso("Notificaciones push (FCM)", "sin FCM_SERVICE_ACCOUNT_JSON: no se envían push")
    r.ok("URL de la app (APP_URL)", APP_URL) if APP_URL.startswith("https://") else r.aviso("URL de la app (APP_URL)", f"{APP_URL} no es https")
    cors = ", ".join(CORS_ORIGINS)
    r.ok("CORS", cors) if CORS_ORIGINS else r.aviso("CORS", "lista vacía: ningún sitio podrá llamar a la API")
    r.ok("Administradores por correo", f"{len(ADMIN_EMAILS)} definido(s)") if ADMIN_EMAILS else r.aviso("Administradores por correo", "ADMIN_EMAILS vacío: solo hay admins asignados desde el panel")
    return r


def prueba_registro(db: Session, admin: User, p: dict) -> Pasos:
    r = Pasos()
    c = _cliente()
    sufijo = secrets.token_hex(4)
    email = f"qa-{sufijo}@example.com"
    password = f"Qa-{secrets.token_urlsafe(12)}-9"
    try:
        nativo = {"X-Client": "native"}
        resp = c.post("/auth/register", json={"email": email, "password": password}, headers=nativo)
        ok = resp.status_code == 200
        r.verificar(ok, "Registrar una cuenta nueva", f"usuario «{resp.json().get('username')}» creado" if ok else "", f"HTTP {resp.status_code}: {resp.text[:160]}")
        if ok:
            r.verificar("access_token" in resp.cookies or "access_token" in resp.json(), "Se inicia sesión al registrarse", "cookie/token entregado", "no se entregó sesión")
            me = c.get("/auth/me", headers={"Authorization": f"Bearer {resp.json().get('access_token', '')}"})
            r.verificar(me.status_code == 200 and me.json().get("email") == email, "Consultar el perfil recién creado", "/auth/me responde", f"HTTP {me.status_code}")
        dup = c.post("/auth/register", json={"email": email, "password": password})
        r.verificar(dup.status_code == 400, "Rechaza un correo repetido", "400 correcto", f"esperaba 400 y fue {dup.status_code}")
        corta = c.post("/auth/register", json={"email": f"qa-{secrets.token_hex(4)}@example.com", "password": "abc"})
        r.verificar(corta.status_code == 400, "Rechaza una contraseña corta", "400 correcto", f"esperaba 400 y fue {corta.status_code}")
    finally:
        _borrar_usuario_por_email(db, email)
        r.ok("Limpieza", "usuario de prueba eliminado")
    return r


def prueba_login(db: Session, admin: User, p: dict) -> Pasos:
    r = Pasos()
    c = _cliente()
    nativo = {"X-Client": "native"}
    with usuario_temporal(db) as (u, password):
        por_correo = c.post("/auth/login", json={"credential": u.email, "password": password}, headers=nativo)
        r.verificar(por_correo.status_code == 200, "Ingresar con el correo", "200", f"HTTP {por_correo.status_code}")
        por_usuario = c.post("/auth/login", json={"credential": u.username, "password": password}, headers=nativo)
        r.verificar(por_usuario.status_code == 200, "Ingresar con el nombre de usuario", "200", f"HTTP {por_usuario.status_code}")
        mala = c.post("/auth/login", json={"credential": u.email, "password": password + "x"})
        r.verificar(mala.status_code == 401, "Rechaza una contraseña incorrecta", "401 correcto", f"esperaba 401 y fue {mala.status_code}")
        nadie = c.post("/auth/login", json={"credential": f"no-existe-{secrets.token_hex(3)}", "password": password})
        r.verificar(nadie.status_code == 401, "Rechaza un usuario inexistente", "401 correcto", f"esperaba 401 y fue {nadie.status_code}")
        token = por_correo.json().get("access_token", "")
        h = {"Authorization": f"Bearer {token}"}
        r.verificar(c.get("/auth/me", headers=h).status_code == 200, "La sesión (token) es válida", "/auth/me 200", "el token recién emitido no sirve")
        c.post("/auth/logout", headers=h)
        r.verificar(c.get("/auth/me", headers=h).status_code == 401, "Cerrar sesión invalida el token", "401 tras salir", "el token sigue funcionando después de cerrar sesión")
        # cuenta suspendida (desde otra IP para no agotar el límite de intentos)
        otro = _cliente()
        u = db.query(User).filter(User.email == u.email).first()
        u.activo = False
        db.commit()
        susp = otro.post("/auth/login", json={"credential": u.email, "password": password})
        r.verificar(susp.status_code == 403, "Una cuenta suspendida no puede ingresar", "403 correcto", f"esperaba 403 y fue {susp.status_code}")
    r.ok("Limpieza", "usuario de prueba eliminado")
    return r


def prueba_restablecer(db: Session, admin: User, p: dict) -> Pasos:
    r = Pasos()
    c = _cliente()
    correos: list[str] = []

    def capturar(destinatarios, asunto, html, texto):
        correos.append(texto)
        return True

    with usuario_temporal(db) as (u, password):
        nueva = f"Nueva-{secrets.token_urlsafe(12)}-7"
        # El correo se captura en vez de enviarse: la prueba no escribe a nadie
        with patch("services.password_reset.enviar_correo", capturar):
            resp = c.post("/auth/password/olvide", json={"email": u.email})
            r.verificar(resp.status_code == 200 and len(correos) == 1, "Solicitar el enlace de restablecimiento", "correo generado (no se envió)", f"HTTP {resp.status_code}, correos: {len(correos)}")
            c.post("/auth/password/olvide", json={"email": u.email})
            r.verificar(len(correos) == 1, "No se envían correos en ráfaga", "el segundo intento inmediato se frena", f"se generaron {len(correos)} correos")
        m = re.search(r"#token=(\S+)", correos[0]) if correos else None
        r.verificar(bool(m), "El enlace lleva el token en el fragmento (#)", "formato correcto", "no se encontró el token")
        token = m.group(1) if m else ""
        r.verificar(c.post("/auth/password/restablecer", json={"token": "falso", "password": nueva}).status_code == 400, "Rechaza un token inventado", "400 correcto", "aceptó un token inválido")
        r.verificar(c.post("/auth/password/restablecer", json={"token": token, "password": "corta"}).status_code == 400, "Rechaza una contraseña corta", "400 correcto", "aceptó una contraseña corta")
        ok = c.post("/auth/password/restablecer", json={"token": token, "password": nueva})
        r.verificar(ok.status_code == 200, "Cambia la contraseña con el token", "200", f"HTTP {ok.status_code}: {ok.text[:120]}")
        r.verificar(c.post("/auth/password/restablecer", json={"token": token, "password": nueva + "x"}).status_code == 400, "El token es de un solo uso", "el segundo uso se rechaza", "el token se pudo usar dos veces")
        r.verificar(c.post("/auth/login", json={"credential": u.email, "password": nueva}).status_code == 200, "Ingresa con la contraseña nueva", "200", "no deja ingresar con la nueva")
        r.verificar(c.post("/auth/login", json={"credential": u.email, "password": password}).status_code == 401, "La contraseña anterior deja de servir", "401 correcto", "la anterior sigue funcionando")
    r.ok("Limpieza", "usuario de prueba eliminado")
    return r


def prueba_radicados(db: Session, admin: User, p: dict) -> Pasos:
    r = Pasos()
    c = _cliente()
    radicado = (p.get("radicado") or RADICADO_EJEMPLO).strip()
    if not re.fullmatch(r"\d{23}", radicado):
        return _un_fallo("Radicado", "debe tener 23 dígitos")
    with usuario_temporal(db) as (u, _):
        h = _bearer(u)
        t = time.perf_counter()
        add = c.post("/procesos/add", json={"llave_proceso": radicado, "categoria": "General"}, headers=h)
        r.verificar(add.status_code == 200 and add.json().get("created"), "Ingresar un radicado", f"creado en {_ms(t)} ms", f"HTTP {add.status_code}: {add.text[:160]}")
        lista = c.get("/procesos/", headers=h).json()
        r.verificar(lista.get("total") == 1, "Aparece en la lista del usuario", "1 proceso", f"total={lista.get('total')}")
        if lista.get("procesos"):
            despacho = lista["procesos"][0].get("despacho")
            r.ok("Datos traídos de Rama Judicial", despacho) if despacho else r.aviso("Datos traídos de Rama Judicial", "se guardó sin datos: Rama no respondió o no encontró el radicado")
        r.verificar(c.post("/procesos/add", json={"llave_proceso": radicado}, headers=h).status_code == 409, "Rechaza un radicado repetido", "409 correcto", "permitió duplicarlo")
        r.verificar(c.post("/procesos/add", json={"llave_proceso": "123"}, headers=h).status_code == 422, "Rechaza un radicado mal formado", "422 correcto", "aceptó un radicado inválido")
        r.verificar(c.patch(f"/procesos/{radicado}", json={"alias": "Cliente de prueba"}, headers=h).status_code == 200, "Editar el alias", "200", "no se pudo editar")
        r.verificar(c.get(f"/procesos/{radicado}", headers=h).status_code == 200, "Abrir el detalle", "200", "el detalle no abre")
        r.verificar(c.delete(f"/procesos/{radicado}", headers=h).status_code == 200, "Eliminar el radicado", "200", "no se pudo eliminar")
        r.verificar(c.get("/procesos/", headers=h).json().get("total") == 0, "La lista queda vacía", "0 procesos", "el radicado sigue en la lista")
    r.ok("Limpieza", "usuario de prueba eliminado")
    return r


def _un_fallo(nombre: str, detalle: str) -> Pasos:
    r = Pasos()
    r.fallo(nombre, detalle)
    return r


def prueba_correo(db: Session, admin: User, p: dict) -> Pasos:
    from services.email_restablecer import template_restablecer
    from services.email_templates import template_novedad
    from services.notifications import _enviar_brevo, _enviar_sendgrid, _enviar_smtp

    r = Pasos()
    try:
        template_novedad("0" * 23, "Juzgado de prueba", "Antioquia", None, "DEMANDANTE: A | DEMANDADO: B")
        template_restablecer("prueba", "https://ejemplo.com/restablecer#token=x", 30)
        r.ok("Plantillas de correo", "novedad y restablecimiento se generan bien")
    except Exception as exc:
        r.fallo("Plantillas de correo", str(exc))
    proveedores = [("Brevo", BREVO_API_KEY, _enviar_brevo), ("SendGrid", SENDGRID_API_KEY, _enviar_sendgrid), ("SMTP", SMTP_HOST, _enviar_smtp)]
    configurados = [(n, f) for n, v, f in proveedores if v]
    if not configurados:
        r.fallo("Proveedores de correo", "ninguno configurado")
        return r
    r.ok("Proveedores configurados", ", ".join(n for n, _ in configurados))
    if not p.get("enviar", True):
        r.aviso("Envío real", "omitido (solo se revisó la configuración)")
        return r
    destino = (p.get("destino") or admin.email).strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", destino):
        r.fallo("Destinatario", "correo inválido")
        return r
    funcionan = 0
    for nombre, enviar in configurados:
        t = time.perf_counter()
        ok, error = enviar([destino], "Prueba de correo · Mariana's", "<p>Prueba enviada desde el panel de administración de Mariana's.</p>", "Prueba enviada desde el panel de administración de Mariana's.")
        funcionan += bool(ok)
        r.ok(f"Envío por {nombre}", f"enviado a {destino} en {_ms(t)} ms") if ok else r.fallo(f"Envío por {nombre}", str(error)[:200])
    if 0 < funcionan < len(configurados):
        r.aviso("Resumen", "al menos un proveedor falla; el sistema usa el siguiente de la lista, pero conviene revisarlo")
    return r


def prueba_push(db: Session, admin: User, p: dict) -> Pasos:
    from services import push

    r = Pasos()
    if not FCM_SERVICE_ACCOUNT_JSON:
        r.aviso("Credenciales FCM", "FCM_SERVICE_ACCOUNT_JSON no está configurado: las notificaciones push están desactivadas")
        return r
    cuenta = push._cuenta()
    if not r.verificar(cuenta is not None, "Cuenta de servicio de Firebase", f"proyecto {cuenta['project_id']}" if cuenta else "", "el JSON no es válido"):
        return r
    t = time.perf_counter()
    try:
        push._token_acceso(cuenta)
        r.ok("Autenticación con Google", f"token de acceso obtenido en {_ms(t)} ms")
    except Exception as exc:
        r.fallo("Autenticación con Google", str(exc)[:200])
        return r
    usuario_id = int(p.get("usuario_id") or admin.id)
    n = db.query(func.count(Dispositivo.id)).filter(Dispositivo.user_id == usuario_id).scalar()
    r.ok("Celulares registrados del usuario", str(n)) if n else r.aviso("Celulares registrados del usuario", "ninguno: la persona debe activar los avisos en la app")
    if p.get("enviar", True) and n:
        demora = max(0, min(int(p.get("demora") or 0), 60))
        titulo, cuerpo = "Novedad judicial (prueba)", "Aviso de prueba enviado desde el panel de administración"
        if demora:
            threading.Timer(demora, push.notificar_usuario, args=(usuario_id, titulo, cuerpo)).start()
            r.ok("Aviso programado", f"llegará en {demora} s: cierra la app para probar con ella cerrada")
        else:
            res = push.notificar_usuario_detalle(usuario_id, titulo, cuerpo)
            if res.aceptados:
                r.ok("Aviso aceptado por FCM", f"{res.aceptados} de {res.dispositivos} celular(es)")
            else:
                r.fallo("Aviso aceptado por FCM", "ningún celular lo recibió: " + ("; ".join(res.errores) or f"{len(res.tokens_invalidos)} token(s) caducado(s), ya borrados: la persona debe abrir la app para volver a registrarse"))
            if res.aceptados and res.errores:
                r.aviso("Algunos celulares fallaron", "; ".join(res.errores))
            if res.tokens_invalidos and res.aceptados:
                r.aviso("Celulares caducados", f"{len(res.tokens_invalidos)} token(s) borrados")
    return r


def prueba_telegram(db: Session, admin: User, p: dict) -> Pasos:
    from services.telegram import notificar_telegram

    r = Pasos()
    if not TELEGRAM_BOT_TOKEN:
        r.aviso("Bot de Telegram", "TELEGRAM_BOT_TOKEN no está configurado: los avisos por Telegram están desactivados")
        return r
    try:
        resp = httpx.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe", timeout=10).json()
        if not r.verificar(resp.get("ok"), "Token del bot", f"@{resp.get('result', {}).get('username')}", "Telegram rechazó el token"):
            return r
    except Exception as exc:
        r.fallo("Conexión con Telegram", str(exc)[:200])
        return r
    usuario = db.get(User, int(p["usuario_id"])) if p.get("usuario_id") else admin
    chat_id = (usuario.telegram_chat_id if usuario else None) or TELEGRAM_CHAT_ID
    if not chat_id:
        r.aviso("Chat de destino", f"{usuario.email if usuario else 'el usuario'} no tiene un chat vinculado")
        return r
    r.ok("Chat de destino", f"{usuario.email if usuario else ''} → {chat_id}")
    if p.get("enviar", True):
        ok = notificar_telegram("", "", "", None, custom_mensaje="Mensaje de prueba enviado desde el panel de administración de Mariana's.", chat_id=str(chat_id))
        r.ok("Mensaje enviado", "revisa el chat de Telegram") if ok else r.fallo("Mensaje enviado", "Telegram no lo aceptó (¿el usuario inició el chat con el bot?)")
    return r


def prueba_rama(db: Session, admin: User, p: dict) -> Pasos:
    from scraper.rama_client import buscar_por_radicado, rama_health_check

    r = Pasos()
    t = time.perf_counter()
    activo = rama_health_check()
    r.verificar(activo, "Rama Judicial responde", f"{_ms(t)} ms", "no responde: las sincronizaciones fallarán hasta que vuelva")
    radicado = (p.get("radicado") or "").strip()
    if radicado and activo:
        if not re.fullmatch(r"\d{23}", radicado):
            r.fallo("Radicado", "debe tener 23 dígitos")
            return r
        t = time.perf_counter()
        try:
            res = buscar_por_radicado(radicado, solo_activos=False)
            if res.procesos:
                r.ok("Consulta del radicado", f"{len(res.procesos)} proceso(s) en {_ms(t)} ms · {res.procesos[0].despacho}")
            else:
                r.aviso("Consulta del radicado", "Rama no devolvió procesos para ese número")
        except Exception as exc:
            r.fallo("Consulta del radicado", str(exc)[:200])
    return r


# id → (nombre, descripcion, funcion, parametros, parametros_en_ejecutar_todas)
CATALOGO: dict[str, dict] = {
    "bd": {"nombre": "Base de datos", "descripcion": "Conexión, migraciones al día y lectura de tablas.", "funcion": prueba_bd, "parametros": []},
    "configuracion": {"nombre": "Configuración", "descripcion": "Variables de entorno clave (sin mostrar valores secretos).", "funcion": prueba_configuracion, "parametros": []},
    "registro": {"nombre": "Registro de cuentas", "descripcion": "Crea una cuenta real vía API, valida duplicados y contraseñas débiles, y la borra.", "funcion": prueba_registro, "parametros": []},
    "login": {"nombre": "Ingreso (login)", "descripcion": "Correo y usuario, contraseña incorrecta, cierre de sesión que invalida el token y cuenta suspendida.", "funcion": prueba_login, "parametros": []},
    "restablecer": {"nombre": "Restablecer contraseña", "descripcion": "Solicitud, token de un solo uso, contraseña nueva y anterior invalidada. No envía correos.", "funcion": prueba_restablecer, "parametros": []},
    "radicados": {
        "nombre": "Ingreso de radicados",
        "descripcion": "Con un usuario temporal: agregar, duplicado, formato inválido, editar, detalle y eliminar. Consulta Rama Judicial.",
        "funcion": prueba_radicados,
        "parametros": [{"nombre": "radicado", "tipo": "texto", "etiqueta": "Radicado (23 dígitos)", "defecto": RADICADO_EJEMPLO}],
    },
    "correo": {
        "nombre": "Correo",
        "descripcion": "Plantillas y envío real de un correo de prueba por cada proveedor configurado.",
        "funcion": prueba_correo,
        "parametros": [{"nombre": "destino", "tipo": "email", "etiqueta": "Enviar a", "defecto": "@admin"}],
        "en_todas": {"enviar": False},
    },
    "push": {
        "nombre": "Notificaciones push",
        "descripcion": "Credenciales de Firebase y envío de un aviso a los celulares de un usuario (con demora opcional para probar con la app cerrada).",
        "funcion": prueba_push,
        "parametros": [
            {"nombre": "usuario_id", "tipo": "usuario", "etiqueta": "Usuario", "defecto": "@admin"},
            {"nombre": "demora", "tipo": "numero", "etiqueta": "Demora (s)", "defecto": 0},
        ],
        "en_todas": {"enviar": False},
    },
    "telegram": {
        "nombre": "Telegram",
        "descripcion": "Valida el bot y envía un mensaje al chat vinculado de un usuario.",
        "funcion": prueba_telegram,
        "parametros": [{"nombre": "usuario_id", "tipo": "usuario", "etiqueta": "Usuario", "defecto": "@admin"}],
        "en_todas": {"enviar": False},
    },
    "rama": {
        "nombre": "Rama Judicial",
        "descripcion": "Disponibilidad del servicio y, opcionalmente, consulta de un radicado sin guardarlo.",
        "funcion": prueba_rama,
        "parametros": [{"nombre": "radicado", "tipo": "texto", "etiqueta": "Radicado (opcional)", "defecto": ""}],
    },
}


def ejecutar(prueba_id: str, db: Session, admin: User, parametros: dict | None = None) -> dict:
    meta = CATALOGO[prueba_id]
    inicio = time.perf_counter()
    try:
        pasos = meta["funcion"](db, admin, parametros or {})
    except Exception as exc:  # una prueba nunca debe tumbar el panel
        db.rollback()
        pasos = _un_fallo("Error inesperado de la prueba", f"{type(exc).__name__}: {exc}"[:300])
    n = {e: sum(1 for i in pasos.items if i["estado"] == e) for e in ("ok", "aviso", "fallo")}
    resumen = f"{n['ok']} correcta(s)" + (f", {n['aviso']} aviso(s)" if n["aviso"] else "") + (f", {n['fallo']} fallo(s)" if n["fallo"] else "")
    return {
        "id": prueba_id,
        "nombre": meta["nombre"],
        "estado": pasos.estado,
        "resumen": resumen if pasos.items else "sin pasos",
        "pasos": pasos.items,
        "ms": _ms(inicio),
    }

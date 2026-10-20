"""Panel de administracion (solo administradores): resumen, usuarios, procesos, dispositivos y auditoria.

Los administradores son cuentas normales: rol en la base de datos (`is_admin`) o correo en ADMIN_EMAILS.
No existe usuario ni contrasena por defecto. Cada accion que modifica algo queda en `audit_log`.
"""
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, constr
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from config import ADMIN_EMAILS, API_TOKEN, BREVO_API_KEY, FCM_SERVICE_ACCOUNT_JSON, SENDGRID_API_KEY, SMTP_HOST, TELEGRAM_BOT_TOKEN
from models.audit_log import AuditLog
from models.database import get_db
from models.dispositivo import Dispositivo
from models.password_reset import PasswordReset
from models.proceso import Proceso
from models.user import User
from services import password_reset
from services.auditoria import auditar
from services.auth import es_admin, get_current_user, get_password_hash, password_en_filtraciones
from services.limiter import limiter

router = APIRouter(prefix="/panel", tags=["panel-admin"])

_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,30}$")
_RADICADO_RE = re.compile(r"^\d{23}$")


def requiere_admin(current_user: User = Depends(get_current_user)) -> User:
    if not es_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    return current_user


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Resumen ────────────────────────────────────────────────────────────────
@router.get("/resumen")
@limiter.limit("60/minute")
def resumen(request: Request, db: Session = Depends(get_db), _: User = Depends(requiere_admin)):
    ahora = _ahora()
    ayer = ahora - timedelta(hours=24)
    return {
        "usuarios": {
            "total": db.query(func.count(User.id)).scalar(),
            "activos": db.query(func.count(User.id)).filter(User.activo.is_(True)).scalar(),
            "admins": db.query(func.count(User.id)).filter(User.is_admin.is_(True)).scalar(),
            "nuevos_7d": db.query(func.count(User.id)).filter(User.created_at >= ahora - timedelta(days=7)).scalar(),
        },
        "procesos": {
            "total": db.query(func.count(Proceso.id)).scalar(),
            "con_novedad": db.query(func.count(Proceso.id)).filter(Proceso.notificado.is_(False)).scalar(),
            "sin_sincronizar_24h": db.query(func.count(Proceso.id))
            .filter(or_(Proceso.ultima_sincronizacion.is_(None), Proceso.ultima_sincronizacion < ayer))
            .scalar(),
            "con_fallos": db.query(func.count(Proceso.id)).filter(Proceso.fallos_consecutivos > 0).scalar(),
            "aviso_pendiente": db.query(func.count(Proceso.id)).filter(Proceso.notificacion_pendiente.is_(True)).scalar(),
        },
        "dispositivos": db.query(func.count(Dispositivo.id)).scalar(),
        "ultima_sincronizacion": db.query(func.max(Proceso.ultima_sincronizacion)).scalar(),
        "integraciones": {
            "correo": [n for n, activo in (("brevo", BREVO_API_KEY), ("sendgrid", SENDGRID_API_KEY), ("smtp", SMTP_HOST)) if activo],
            "telegram": bool(TELEGRAM_BOT_TOKEN),
            "push": bool(FCM_SERVICE_ACCOUNT_JSON),
            "api_token": bool(API_TOKEN),
            "admins_por_correo": len(ADMIN_EMAILS),
        },
    }


# ── Usuarios ───────────────────────────────────────────────────────────────
def _usuario_dto(db: Session, u: User, n_procesos: int | None = None, n_dispositivos: int | None = None) -> dict:
    if n_procesos is None:
        n_procesos = db.query(func.count(Proceso.id)).filter(Proceso.user_id == u.id).scalar()
    if n_dispositivos is None:
        n_dispositivos = db.query(func.count(Dispositivo.id)).filter(Dispositivo.user_id == u.id).scalar()
    return {
        "id": u.id,
        "email": u.email,
        "username": u.username,
        "activo": bool(u.activo),
        "es_admin": es_admin(u),
        "admin_por_correo": (u.email or "").lower() in ADMIN_EMAILS,
        "telegram_chat_id": u.telegram_chat_id,
        "tiene_avatar": bool(u.avatar_mime),
        "creado_en": u.created_at,
        "ultimo_acceso": u.ultimo_acceso,
        "procesos": n_procesos,
        "dispositivos": n_dispositivos,
    }


@router.get("/usuarios")
@limiter.limit("120/minute")
def listar_usuarios(
    request: Request,
    q: str = Query(None),
    estado: str = Query(None, pattern="^(activos|suspendidos|admins)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(requiere_admin),
):
    query = db.query(User)
    if q:
        term = f"%{q}%"
        query = query.filter(or_(User.email.ilike(term), User.username.ilike(term)))
    if estado == "activos":
        query = query.filter(User.activo.is_(True))
    elif estado == "suspendidos":
        query = query.filter(User.activo.is_(False))
    elif estado == "admins":
        query = query.filter(or_(User.is_admin.is_(True), func.lower(User.email).in_(ADMIN_EMAILS or {""})))
    total = query.count()
    usuarios = query.order_by(User.id.desc()).offset(skip).limit(limit).all()
    ids = [u.id for u in usuarios]
    procesos = dict(db.query(Proceso.user_id, func.count(Proceso.id)).filter(Proceso.user_id.in_(ids)).group_by(Proceso.user_id).all()) if ids else {}
    dispositivos = dict(db.query(Dispositivo.user_id, func.count(Dispositivo.id)).filter(Dispositivo.user_id.in_(ids)).group_by(Dispositivo.user_id).all()) if ids else {}
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "usuarios": [_usuario_dto(db, u, procesos.get(u.id, 0), dispositivos.get(u.id, 0)) for u in usuarios],
    }


def _obtener_usuario(db: Session, user_id: int) -> User:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return u


@router.get("/usuarios/{user_id}")
@limiter.limit("120/minute")
def detalle_usuario(request: Request, user_id: int, db: Session = Depends(get_db), _: User = Depends(requiere_admin)):
    return _usuario_dto(db, _obtener_usuario(db, user_id))


class NuevoUsuario(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    es_admin: bool = False
    password: Optional[str] = None  # sin contrasena: se envia una invitacion para elegirla


def _validar_username(db: Session, username: str, excepto_id: int | None = None) -> str:
    nuevo = username.strip()
    if not _USERNAME_RE.fullmatch(nuevo):
        raise HTTPException(status_code=400, detail="El usuario debe tener de 3 a 30 caracteres: letras, números, punto o guion bajo")
    q = db.query(User).filter(func.lower(User.username) == nuevo.lower())
    if excepto_id:
        q = q.filter(User.id != excepto_id)
    if q.first():
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está en uso")
    return nuevo


@router.post("/usuarios", status_code=201)
@limiter.limit("30/minute")
def crear_usuario(request: Request, payload: NuevoUsuario, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    email = payload.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="El correo ya está registrado")
    username = _validar_username(db, payload.username or re.sub(r"[^A-Za-z0-9_.]", "", email.split("@")[0])[:30].ljust(3, "0"))
    if payload.password is not None:
        if len(payload.password) < 8:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
        if password_en_filtraciones(payload.password):
            raise HTTPException(status_code=400, detail="Esa contraseña aparece en filtraciones conocidas")
        clave = payload.password
    else:
        clave = secrets.token_urlsafe(24)  # inutilizable: la persona elige la suya con el enlace de invitacion
    user = User(email=email, username=username, password_hash=get_password_hash(clave), is_admin=payload.es_admin)
    db.add(user)
    db.commit()
    db.refresh(user)
    invitacion = None
    if payload.password is None:
        invitacion = password_reset.enviar_enlace(db, user)
    auditar(db, admin, "usuario.crear", email, f"admin={payload.es_admin} invitacion={invitacion}")
    return {**_usuario_dto(db, user), "invitacion": invitacion}


class CambiosUsuario(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    telegram_chat_id: Optional[constr(max_length=40)] = None  # "" lo desvincula
    es_admin: Optional[bool] = None
    activo: Optional[bool] = None


@router.patch("/usuarios/{user_id}")
@limiter.limit("60/minute")
def editar_usuario(request: Request, user_id: int, payload: CambiosUsuario, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    u = _obtener_usuario(db, user_id)
    es_uno_mismo = u.id == admin.id
    cambios: list[str] = []

    if payload.email is not None and payload.email.lower() != (u.email or "").lower():
        if db.query(User).filter(func.lower(User.email) == payload.email.lower(), User.id != u.id).first():
            raise HTTPException(status_code=409, detail="El correo ya está registrado")
        cambios.append(f"email {u.email} -> {payload.email.lower()}")
        u.email = payload.email.lower()
        u.token_version = (u.token_version or 0) + 1  # las sesiones usan el correo como identidad
    if payload.username is not None and payload.username != u.username:
        nuevo = _validar_username(db, payload.username, u.id)
        cambios.append(f"usuario {u.username} -> {nuevo}")
        u.username = nuevo
    if payload.telegram_chat_id is not None:
        u.telegram_chat_id = payload.telegram_chat_id.strip() or None
        cambios.append("telegram")
    if payload.es_admin is not None and payload.es_admin != bool(u.is_admin):
        if es_uno_mismo and not payload.es_admin:
            raise HTTPException(status_code=400, detail="No puedes quitarte tu propio rol de administrador")
        u.is_admin = payload.es_admin
        cambios.append(f"admin={payload.es_admin}")
    if payload.activo is not None and payload.activo != bool(u.activo):
        if es_uno_mismo and not payload.activo:
            raise HTTPException(status_code=400, detail="No puedes suspender tu propia cuenta")
        u.activo = payload.activo
        cambios.append(f"activo={payload.activo}")

    if cambios:
        db.commit()
        auditar(db, admin, "usuario.editar", u.email, "; ".join(cambios))
    return _usuario_dto(db, u)


def _borrar_usuario(db: Session, u: User) -> None:
    # Se borran explicitamente (no solo por ON DELETE CASCADE) para que funcione igual en cualquier base
    db.query(Dispositivo).filter(Dispositivo.user_id == u.id).delete(synchronize_session=False)
    db.query(PasswordReset).filter(PasswordReset.user_id == u.id).delete(synchronize_session=False)
    db.delete(u)  # arrastra sus procesos, actuaciones y documentos (cascade del modelo)
    db.commit()


@router.delete("/usuarios/{user_id}")
@limiter.limit("30/minute")
def eliminar_usuario(request: Request, user_id: int, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    u = _obtener_usuario(db, user_id)
    if u.id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta desde el panel")
    if (u.email or "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Es un administrador definido en ADMIN_EMAILS: quítalo de esa variable primero")
    email, n = u.email, db.query(func.count(Proceso.id)).filter(Proceso.user_id == u.id).scalar()
    _borrar_usuario(db, u)
    auditar(db, admin, "usuario.eliminar", email, f"procesos eliminados: {n}")
    return {"deleted": True}


@router.post("/usuarios/{user_id}/cerrar-sesiones")
@limiter.limit("30/minute")
def cerrar_sesiones(request: Request, user_id: int, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    u = _obtener_usuario(db, user_id)
    u.token_version = (u.token_version or 0) + 1
    db.commit()
    auditar(db, admin, "usuario.cerrar_sesiones", u.email)
    return {"ok": True}


@router.post("/usuarios/{user_id}/enviar-reset")
@limiter.limit("10/minute")
def enviar_reset(request: Request, user_id: int, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    u = _obtener_usuario(db, user_id)
    estado = password_reset.enviar_enlace(db, u)
    auditar(db, admin, "usuario.enviar_reset", u.email, estado)
    return {"estado": estado}


# ── Procesos (de todos los usuarios) ───────────────────────────────────────
def _proceso_dto(p: Proceso, email: str | None) -> dict:
    return {
        "id": p.id,
        "usuario_id": p.user_id,
        "usuario_email": email,
        "llave_proceso": p.llave_proceso,
        "alias": p.alias,
        "despacho": p.despacho,
        "departamento": p.departamento,
        "categoria": p.categoria,
        "notificado": p.notificado,
        "fecha_ultima_actuacion": p.fecha_ultima_actuacion,
        "ultima_sincronizacion": p.ultima_sincronizacion,
        "fallos_consecutivos": p.fallos_consecutivos,
        "notificacion_pendiente": p.notificacion_pendiente,
        "canales_notificados": p.canales_notificados,
        "creado_en": p.creado_en,
    }


@router.get("/procesos")
@limiter.limit("120/minute")
def listar_procesos(
    request: Request,
    q: str = Query(None),
    usuario_id: int = Query(None),
    categoria: str = Query(None),
    estado: str = Query(None, pattern="^(novedad|al_dia|con_fallos|aviso_pendiente)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(requiere_admin),
):
    query = db.query(Proceso, User.email).join(User, User.id == Proceso.user_id)
    if q:
        term = f"%{q}%"
        query = query.filter(or_(Proceso.llave_proceso.ilike(term), Proceso.alias.ilike(term), Proceso.despacho.ilike(term), User.email.ilike(term)))
    if usuario_id:
        query = query.filter(Proceso.user_id == usuario_id)
    if categoria:
        query = query.filter(Proceso.categoria == categoria)
    if estado == "novedad":
        query = query.filter(Proceso.notificado.is_(False))
    elif estado == "al_dia":
        query = query.filter(Proceso.notificado.is_(True))
    elif estado == "con_fallos":
        query = query.filter(Proceso.fallos_consecutivos > 0)
    elif estado == "aviso_pendiente":
        query = query.filter(Proceso.notificacion_pendiente.is_(True))
    total = query.count()
    filas = query.order_by(Proceso.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "skip": skip, "limit": limit, "procesos": [_proceso_dto(p, email) for p, email in filas]}


class NuevoProceso(BaseModel):
    usuario_id: int
    llave_proceso: constr(pattern=r"^\d{23}$")
    categoria: str = "General"
    alias: Optional[constr(max_length=100)] = None


@router.post("/procesos", status_code=201)
@limiter.limit("60/minute")
def crear_proceso(request: Request, payload: NuevoProceso, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    dueno = _obtener_usuario(db, payload.usuario_id)
    if db.query(Proceso).filter(Proceso.user_id == dueno.id, Proceso.llave_proceso == payload.llave_proceso).first():
        raise HTTPException(status_code=409, detail="Ese usuario ya tiene el radicado")
    p = Proceso(user_id=dueno.id, llave_proceso=payload.llave_proceso, categoria=payload.categoria, alias=payload.alias, notificado=True)
    db.add(p)
    db.commit()
    db.refresh(p)
    auditar(db, admin, "proceso.crear", payload.llave_proceso, f"para {dueno.email}")
    return _proceso_dto(p, dueno.email)


class CambiosProceso(BaseModel):
    categoria: Optional[str] = None
    alias: Optional[constr(max_length=100)] = None  # "" lo borra
    notificado: Optional[bool] = None
    despacho: Optional[str] = None


def _obtener_proceso(db: Session, proceso_id: int) -> Proceso:
    p = db.get(Proceso, proceso_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")
    return p


@router.patch("/procesos/{proceso_id}")
@limiter.limit("120/minute")
def editar_proceso(request: Request, proceso_id: int, payload: CambiosProceso, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    p = _obtener_proceso(db, proceso_id)
    cambios = []
    if payload.categoria is not None:
        p.categoria = payload.categoria
        cambios.append(f"categoria={payload.categoria}")
    if payload.alias is not None:
        p.alias = payload.alias.strip() or None
        cambios.append("alias")
    if payload.notificado is not None:
        p.notificado = payload.notificado
        cambios.append(f"notificado={payload.notificado}")
    if payload.despacho is not None:
        p.despacho = payload.despacho
        cambios.append("despacho")
    if cambios:
        db.commit()
        auditar(db, admin, "proceso.editar", p.llave_proceso, "; ".join(cambios))
    email = db.query(User.email).filter(User.id == p.user_id).scalar()
    return _proceso_dto(p, email)


@router.delete("/procesos/{proceso_id}")
@limiter.limit("60/minute")
def eliminar_proceso(request: Request, proceso_id: int, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    p = _obtener_proceso(db, proceso_id)
    llave = p.llave_proceso
    db.delete(p)
    db.commit()
    auditar(db, admin, "proceso.eliminar", llave)
    return {"deleted": True}


@router.post("/procesos/{proceso_id}/reprogramar-sync")
@limiter.limit("60/minute")
def reprogramar_sync(request: Request, proceso_id: int, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    """Hace que la proxima sincronizacion en lote lo consulte de nuevo (sin esperar el backoff)."""
    p = _obtener_proceso(db, proceso_id)
    p.ultima_sincronizacion = None
    p.fallos_consecutivos = 0
    db.commit()
    auditar(db, admin, "proceso.reprogramar_sync", p.llave_proceso)
    return {"ok": True}


# ── Dispositivos push ──────────────────────────────────────────────────────
@router.get("/dispositivos")
@limiter.limit("120/minute")
def listar_dispositivos(
    request: Request,
    usuario_id: int = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(requiere_admin),
):
    query = db.query(Dispositivo, User.email).join(User, User.id == Dispositivo.user_id)
    if usuario_id:
        query = query.filter(Dispositivo.user_id == usuario_id)
    total = query.count()
    filas = query.order_by(Dispositivo.id.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "dispositivos": [
            {
                "id": d.id,
                "usuario_id": d.user_id,
                "usuario_email": email,
                "plataforma": d.plataforma,
                "token": f"…{d.token[-8:]}",  # el token completo nunca sale del servidor
                "creado_en": d.creado_en,
                "ultimo_uso": d.ultimo_uso,
            }
            for d, email in filas
        ],
    }


@router.delete("/dispositivos/{dispositivo_id}")
@limiter.limit("60/minute")
def eliminar_dispositivo(request: Request, dispositivo_id: int, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    d = db.get(Dispositivo, dispositivo_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    db.delete(d)
    db.commit()
    auditar(db, admin, "dispositivo.eliminar", f"usuario {d.user_id}", f"…{d.token[-8:]}")
    return {"deleted": True}


# ── Auditoria ──────────────────────────────────────────────────────────────
@router.get("/auditoria")
@limiter.limit("120/minute")
def listar_auditoria(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(requiere_admin),
):
    query = db.query(AuditLog)
    total = query.count()
    filas = query.order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "registros": [
            {"id": r.id, "admin": r.admin_email, "accion": r.accion, "objetivo": r.objetivo, "detalle": r.detalle, "creado_en": r.creado_en}
            for r in filas
        ],
    }

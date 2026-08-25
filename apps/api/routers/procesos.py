import logging
import secrets
import threading
import time as _time
from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, selectinload
from models.database import get_db
from models.actuacion import Actuacion
from models.proceso import Proceso
from services.sync import sincronizar_radicados_lote, _serializar_texto, INTENTOS_MAX_NOTIFICACION
from fastapi.responses import StreamingResponse
from scraper.rama_client import buscar_por_radicado, buscar_detalle_proceso, descargar_documento, rama_health_check
from services.auth import get_current_user, oauth2_scheme
from services.limiter import limiter
from config import API_TOKEN
from typing import Optional
from pydantic import BaseModel, constr
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/procesos", tags=["procesos"])

@router.get("/")
def listar_procesos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    despacho: str = Query(None),
    departamento: str = Query(None),
    categoria: str = Query(None),
    notificado: Optional[bool] = Query(None),
    q: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
):
    query = db.query(Proceso).filter(Proceso.user_id == current_user.id)

    if despacho:
        query = query.filter(Proceso.despacho.ilike(f"%{despacho}%"))
    if departamento:
        query = query.filter(Proceso.departamento.ilike(f"%{departamento}%"))
    if categoria:
        query = query.filter(Proceso.categoria == categoria)
    if notificado is not None:
        query = query.filter(Proceso.notificado == notificado)
    if q:
        term = f"%{q}%"
        query = query.filter(
            or_(
                Proceso.llave_proceso.ilike(term),
                Proceso.sujetos_procesales.ilike(term),
                Proceso.despacho.ilike(term),
            )
        )

    total = query.count()
    procesos = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "total_paginas": (total + limit - 1) // limit if limit else 1,
        "procesos": [
            {
                "llave_proceso": p.llave_proceso,
                "despacho": p.despacho,
                "departamento": p.departamento,
                "sujetos_procesales": p.sujetos_procesales,
                "tipo_proceso": p.tipo_proceso,
                "clase_proceso": p.clase_proceso,
                "es_privado": p.es_privado,
                "categoria": p.categoria,
                "fecha_proceso": p.fecha_proceso,
                "fecha_ultima_actuacion": p.fecha_ultima_actuacion,
                "notificado": p.notificado,
                "creado_en": p.creado_en,
                "actualizado_en": p.actualizado_en,
                "ultima_sincronizacion": p.ultima_sincronizacion,
                "dias_sin_cambios": p.dias_sin_cambios,
                "fallos_consecutivos": p.fallos_consecutivos,
            }
            for p in procesos
        ],
    }

@router.get("/novedades")
def listar_novedades(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    procesos = db.query(Proceso).filter(Proceso.notificado == False, Proceso.user_id == current_user.id).all()
    return {
        "total": len(procesos),
        "novedades": [
            {
                "llave_proceso": p.llave_proceso,
                "despacho": p.despacho,
                "departamento": p.departamento,
                "sujetos_procesales": p.sujetos_procesales,
                "fecha_ultima_actuacion": p.fecha_ultima_actuacion,
                "tipo_novedad": p.tipo_novedad or "nuevo",
            }
            for p in procesos
        ],
    }


def _auth_for_sync(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if API_TOKEN:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer ") and secrets.compare_digest(
            auth_header.split(" ", 1)[1].encode("utf-8"), API_TOKEN.encode("utf-8")
        ):
            return None
    return get_current_user(token=token, db=db)


_sync_estado: dict[int, dict] = {}
_sync_estado_lock = threading.Lock()
_SYNC_ESTADO_MAX = 1000


def _guardar_estado_usuario(user_id: int, estado: dict):
    """Guarda el estado de sync por usuario acotando la memoria del proceso."""
    with _sync_estado_lock:
        if len(_sync_estado) >= _SYNC_ESTADO_MAX and user_id not in _sync_estado:
            terminados = [uid for uid, e in _sync_estado.items() if not e.get("en_curso")]
            for uid in terminados:
                _sync_estado.pop(uid, None)
            while len(_sync_estado) >= _SYNC_ESTADO_MAX:
                _sync_estado.pop(next(iter(_sync_estado)))
        _sync_estado[user_id] = estado


def _ejecutar_sync_usuario(user_id: int, lote: int = 50):
    """Worker de fondo: corre el sync con su propia sesion de BD."""
    from models.database import SessionLocal

    db = SessionLocal()
    try:
        resultado = sincronizar_radicados_lote(db, lote=lote, user_id=user_id)
        _guardar_estado_usuario(user_id, {
            "en_curso": False,
            "resultado": resultado,
            "error": None,
        })
    except Exception as exc:
        logger.exception("Sync en segundo plano fallo para user_id=%s", user_id)
        _guardar_estado_usuario(user_id, {
            "en_curso": False,
            "resultado": None,
            "error": f"{type(exc).__name__}: {exc}",
        })
    finally:
        db.close()


@router.post("/sync")
@limiter.limit("6/minute")
def sync_manual(request: Request, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """Encola la sincronizacion del usuario y responde de inmediato.

    Consultar GET /procesos/sync/estado para saber cuando termina y ver
    el resultado (la operacion puede tardar minutos por Rama Judicial).
    """
    with _sync_estado_lock:
        previo = _sync_estado.get(current_user.id)
        if previo and previo.get("en_curso"):
            return {
                "iniciado": False,
                "mensaje": "Ya hay una sincronizacion en curso",
                "en_curso": True,
            }
    _guardar_estado_usuario(current_user.id, {"en_curso": True, "resultado": None, "error": None})
    background_tasks.add_task(_ejecutar_sync_usuario, current_user.id)
    return {"iniciado": True, "mensaje": "Sincronizacion iniciada", "en_curso": True}


@router.get("/sync/estado")
def sync_estado(current_user: User = Depends(get_current_user)):
    with _sync_estado_lock:
        estado = _sync_estado.get(current_user.id)
    if not estado:
        return {"en_curso": False, "resultado": None, "error": None}
    return {
        "en_curso": estado.get("en_curso", False),
        "resultado": estado.get("resultado"),
        "error": estado.get("error"),
    }


@router.post("/sync-lote")
def sync_lote(current_user: Optional[User] = Depends(_auth_for_sync), db: Session = Depends(get_db)):
    if not API_TOKEN:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="API_TOKEN no configurado")
    if not _check_rama_con_alerta():
        return {"mensaje": "Rama Judicial no responde, se omite sync", "total_consultados": 0}
    try:
        resultado = sincronizar_radicados_lote(db, lote=25)
    except OperationalError as exc:
        # Neon suelta conexiones de forma transitoria; un reintento inmediato
        # evita que un drop puntual tumbe el ciclo horario completo (500).
        logger.warning("OperationalError en sync-lote (%s); rollback y reintento unico", exc)
        db.rollback()
        resultado = sincronizar_radicados_lote(db, lote=25)
    return resultado


class AddRadicado(BaseModel):
    llave_proceso: constr(pattern=r"^\d{23}$")
    despacho: Optional[str] = None
    departamento: Optional[str] = None
    sujetos_procesales: Optional[str] = None
    categoria: Optional[str] = None


@router.post("/add")
@limiter.limit("10/minute")
def add_radicado(request: Request, payload: AddRadicado, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existente = db.query(Proceso).filter(Proceso.llave_proceso == payload.llave_proceso, Proceso.user_id == current_user.id).first()
    if existente:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Radicado ya existe")

    nuevo = Proceso(
        llave_proceso=payload.llave_proceso,
        despacho=payload.despacho or "",
        departamento=payload.departamento or "",
        sujetos_procesales=payload.sujetos_procesales or "",
        categoria=payload.categoria or "General",
        notificado=True,
        user_id=current_user.id,
    )
    db.add(nuevo)
    db.commit()

    try:
        resultado = buscar_por_radicado(payload.llave_proceso, solo_activos=False)
        if resultado.procesos:
            resumen = max(resultado.procesos, key=lambda p: sum(1 for c in [p.despacho, p.departamento, p.sujetos_procesales, p.tipo_proceso, p.clase_proceso, p.fecha_proceso] if (c or "").strip()))
            nuevo.despacho = _serializar_texto(resumen.despacho) or nuevo.despacho
            nuevo.departamento = _serializar_texto(resumen.departamento) or nuevo.departamento
            nuevo.sujetos_procesales = _serializar_texto(resumen.sujetos_procesales) or nuevo.sujetos_procesales
            nuevo.tipo_proceso = _serializar_texto(resumen.tipo_proceso)
            nuevo.clase_proceso = _serializar_texto(resumen.clase_proceso)
            nuevo.fecha_proceso = _serializar_texto(resumen.fecha_proceso)
            es_privado = resumen.es_privado
            if isinstance(es_privado, str):
                es_privado = es_privado.strip().lower() in {"true", "1", "si", "sí"}
            nuevo.es_privado = es_privado

            try:
                detalle = buscar_detalle_proceso(resumen.id_proceso)
                nuevo.despacho = _serializar_texto(detalle.despacho) or nuevo.despacho
                nuevo.tipo_proceso = _serializar_texto(detalle.tipo_proceso) or nuevo.tipo_proceso
                nuevo.clase_proceso = _serializar_texto(detalle.clase_proceso) or nuevo.clase_proceso
                nuevo.fecha_proceso = _serializar_texto(detalle.fecha_proceso) or nuevo.fecha_proceso
                nuevo.es_privado = detalle.es_privado
            except Exception:
                pass

            db.commit()
    except Exception as exc:
        logger.warning("Sync metadata falló para %s: %s", payload.llave_proceso, exc)
        db.rollback()

    return {"created": True, "llave_proceso": payload.llave_proceso}


@router.get("/documento/{id_reg_documento}")
def descargar_documento_endpoint(
    id_reg_documento: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from scraper.rama_client import descargar_documento as _descargar
    from models.documento_actuacion import DocumentoActuacion

    autorizado = (
        db.query(DocumentoActuacion.id)
        .join(Actuacion, DocumentoActuacion.actuacion_id == Actuacion.id)
        .join(Proceso, Actuacion.proceso_id == Proceso.id)
        .filter(
            DocumentoActuacion.id_reg_documento == id_reg_documento,
            Proceso.user_id == current_user.id,
        )
        .first()
    )
    if not autorizado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")

    contenido, filename = _descargar(id_reg_documento)
    return StreamingResponse(
        iter([contenido]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/options")
def opciones_filtros(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    despachos = [d[0] for d in db.query(Proceso.despacho).filter(Proceso.user_id == current_user.id).distinct().all() if d[0]]
    departamentos = [d[0] for d in db.query(Proceso.departamento).filter(Proceso.user_id == current_user.id).distinct().all() if d[0]]
    return {"despachos": sorted(list(set(despachos))), "departamentos": sorted(list(set(departamentos)))}


@router.get("/actuaciones-recientes")
def actuaciones_recientes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    base = (
        db.query(Actuacion)
        .join(Proceso, Actuacion.proceso_id == Proceso.id)
        .filter(Proceso.user_id == current_user.id)
    )
    total = base.with_entities(func.count(Actuacion.id)).scalar()
    actuaciones = (
        base.order_by(Actuacion.fecha_actuacion.desc().nullslast(), Actuacion.id_reg_actuacion.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "actuaciones": [
            {
                "id_reg_actuacion": a.id_reg_actuacion,
                "cons_actuacion": a.cons_actuacion,
                "fecha_actuacion": a.fecha_actuacion,
                "actuacion": a.actuacion,
                "anotacion": a.anotacion,
                "fecha_inicial": a.fecha_inicial,
                "fecha_final": a.fecha_final,
                "fecha_registro": a.fecha_registro,
                "con_documentos": a.con_documentos,
                "cant": a.cant,
                "proceso": {
                    "llave_proceso": a.proceso.llave_proceso,
                    "despacho": a.proceso.despacho,
                    "departamento": a.proceso.departamento,
                },
                "documentos": [
                    {
                        "id_reg_documento": d.id_reg_documento,
                        "nombre": d.nombre,
                        "descripcion": d.descripcion,
                        "tipo": d.tipo,
                        "fecha_carga": d.fecha_carga,
                    }
                    for d in a.documentos
                ],
            }
            for a in actuaciones
        ],
    }


@router.get("/novedades-detalle")
def novedades_detalle(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    limit_actuaciones: int = Query(50, ge=1, le=200),
):
    total = (
        db.query(func.count(Proceso.id))
        .filter(Proceso.notificado == False, Proceso.user_id == current_user.id)
        .scalar()
    )

    procesos = (
        db.query(Proceso)
        .options(selectinload(Proceso.actuaciones).selectinload(Actuacion.documentos))
        .filter(Proceso.notificado == False, Proceso.user_id == current_user.id)
        .order_by(Proceso.fecha_ultima_actuacion.desc().nullslast(), Proceso.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        # Para que el frontend sepa cuando dejar de decir "reintentando"
        "intentos_max_aviso": INTENTOS_MAX_NOTIFICACION,
        "novedades": [
            {
                "llave_proceso": p.llave_proceso,
                "despacho": p.despacho,
                "departamento": p.departamento,
                "categoria": p.categoria,
                "sujetos_procesales": p.sujetos_procesales,
                "fecha_ultima_actuacion": p.fecha_ultima_actuacion,
                "tipo_novedad": p.tipo_novedad or "nuevo",
                "tipo_proceso": p.tipo_proceso,
                "clase_proceso": p.clase_proceso,
                "canales_notificados": p.canales_notificados,
                "notificacion_pendiente": bool(p.notificacion_pendiente),
                "intentos_notificacion": p.intentos_notificacion or 0,
                "actuaciones": [
                    {
                        "id_reg_actuacion": a.id_reg_actuacion,
                        "cons_actuacion": a.cons_actuacion,
                        "fecha_actuacion": a.fecha_actuacion,
                        "actuacion": a.actuacion,
                        "anotacion": a.anotacion,
                        "fecha_inicial": a.fecha_inicial,
                        "fecha_final": a.fecha_final,
                        "fecha_registro": a.fecha_registro,
                        "con_documentos": a.con_documentos,
                        "cant": a.cant,
                        "documentos": [
                            {
                                "id_reg_documento": d.id_reg_documento,
                                "nombre": d.nombre,
                                "descripcion": d.descripcion,
                                "tipo": d.tipo,
                                "fecha_carga": d.fecha_carga,
                            }
                            for d in a.documentos
                        ],
                    }
                    for a in sorted(
                        p.actuaciones,
                        key=lambda a: (
                            a.fecha_actuacion or "",
                            a.id_reg_actuacion or 0,
                        ),
                        reverse=True,
                    )[:limit_actuaciones]
                ],
            }
            for p in procesos
        ],
    }


# Nota: la sincronizacion contra Rama Judicial ya no ocurre dentro del GET de
# detalle (bloqueaba la request hasta minutos). Se actualiza via
# POST /procesos/sync (segundo plano) o el job horario.


@router.get("/{llave_proceso}")
def obtener_proceso(
    llave_proceso: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso, Proceso.user_id == current_user.id).first()
    if not proceso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radicado no encontrado")

    total_actuaciones = (
        db.query(func.count(Actuacion.id))
        .filter(Actuacion.proceso_id == proceso.id)
        .scalar()
    )

    actuaciones = (
        db.query(Actuacion)
        .filter(Actuacion.proceso_id == proceso.id)
        .order_by(Actuacion.fecha_actuacion.desc().nullslast(), Actuacion.id_reg_actuacion.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "llave_proceso": proceso.llave_proceso,
        "despacho": proceso.despacho,
        "departamento": proceso.departamento,
        "sujetos_procesales": proceso.sujetos_procesales,
        "tipo_proceso": proceso.tipo_proceso,
        "clase_proceso": proceso.clase_proceso,
        "es_privado": proceso.es_privado,
        "categoria": proceso.categoria,
        "fecha_proceso": proceso.fecha_proceso,
        "fecha_ultima_actuacion": proceso.fecha_ultima_actuacion,
        "notificado": proceso.notificado,
        "creado_en": proceso.creado_en,
        "actualizado_en": proceso.actualizado_en,
        "ultima_sincronizacion": proceso.ultima_sincronizacion,
        "dias_sin_cambios": proceso.dias_sin_cambios,
        "fallos_consecutivos": proceso.fallos_consecutivos,
        "total_actuaciones": total_actuaciones,
        "skip": skip,
        "limit": limit,
        "actuaciones": [
            {
                "id_reg_actuacion": a.id_reg_actuacion,
                "cons_actuacion": a.cons_actuacion,
                "fecha_actuacion": a.fecha_actuacion,
                "actuacion": a.actuacion,
                "anotacion": a.anotacion,
                "fecha_inicial": a.fecha_inicial,
                "fecha_final": a.fecha_final,
                "fecha_registro": a.fecha_registro,
                "cod_regla": a.cod_regla,
                "con_documentos": a.con_documentos,
                "cant": a.cant,
                "documentos": [
                    {
                        "id_reg_documento": d.id_reg_documento,
                        "guid_documento_sxxiw": d.guid_documento_sxxiw,
                        "nombre": d.nombre,
                        "descripcion": d.descripcion,
                        "tipo": d.tipo,
                        "fecha_carga": d.fecha_carga,
                    }
                    for d in a.documentos
                ],
            }
            for a in actuaciones
        ],
    }


class UpdateProceso(BaseModel):
    llave_proceso: Optional[constr(pattern=r"^\d{23}$")] = None
    despacho: Optional[str] = None
    departamento: Optional[str] = None
    sujetos_procesales: Optional[str] = None
    categoria: Optional[str] = None
    notificado: Optional[bool] = None
    fecha_ultima_actuacion: Optional[datetime] = None


@router.delete("/{llave_proceso}")
@limiter.limit("30/minute")
def delete_proceso(request: Request, llave_proceso: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso, Proceso.user_id == current_user.id).first()
    if not proceso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radicado no encontrado")
    db.delete(proceso)
    db.commit()
    return {"deleted": True, "llave_proceso": llave_proceso}


@router.patch("/{llave_proceso}")
@limiter.limit("30/minute")
def update_proceso(request: Request, llave_proceso: str, payload: UpdateProceso, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso, Proceso.user_id == current_user.id).first()
    if not proceso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radicado no encontrado")

    changed = False
    if payload.llave_proceso is not None and payload.llave_proceso != proceso.llave_proceso:
        existente = db.query(Proceso).filter(Proceso.llave_proceso == payload.llave_proceso, Proceso.user_id == current_user.id).first()
        if existente:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese radicado ya existe")
        proceso.llave_proceso = payload.llave_proceso
        changed = True
    if payload.despacho is not None:
        proceso.despacho = payload.despacho
        changed = True
    if payload.departamento is not None:
        proceso.departamento = payload.departamento
        changed = True
    if payload.sujetos_procesales is not None:
        proceso.sujetos_procesales = payload.sujetos_procesales
        changed = True
    if payload.categoria is not None:
        proceso.categoria = payload.categoria
        changed = True
    if payload.notificado is not None:
        proceso.notificado = payload.notificado
        changed = True
    if payload.fecha_ultima_actuacion is not None:
        proceso.fecha_ultima_actuacion = payload.fecha_ultima_actuacion
        changed = True

    if changed:
        db.add(proceso)
        db.commit()

    return {"updated": changed, "llave_proceso": proceso.llave_proceso}


from services.telegram import notificar_telegram
from config import SENTRY_DSN

if SENTRY_DSN:
    import sentry_sdk

_rama_lock = threading.Lock()
_rama_fallos = 0
_rama_ultima_alerta: float = 0
_RAMA_ALERTA_THRESHOLD = 3
_RAMA_ALERTA_COOLDOWN = 6 * 3600


def _check_rama_con_alerta() -> bool:
    global _rama_fallos, _rama_ultima_alerta
    with _rama_lock:
        if rama_health_check():
            _rama_fallos = 0
            return True
        _rama_fallos += 1
        logger.warning("Rama Judicial no responde (intento %d/%d)", _rama_fallos, _RAMA_ALERTA_THRESHOLD)
        if SENTRY_DSN:
            sentry_sdk.capture_message(f"Rama Judicial caida (intento {_rama_fallos})", level="warning")
        if _rama_fallos >= _RAMA_ALERTA_THRESHOLD:
            ahora = _time.time()
            if ahora - _rama_ultima_alerta > _RAMA_ALERTA_COOLDOWN:
                _rama_ultima_alerta = ahora
                logger.error("Rama Judicial lleva %d intentos fallidos. Enviando alerta...", _rama_fallos)
                if SENTRY_DSN:
                    sentry_sdk.capture_message("Rama Judicial caida persistente — alerta enviada por Telegram", level="error")
                notificar_telegram(
                    llave_proceso="",
                    despacho="",
                    departamento="",
                    fecha_ultima_actuacion=None,
                    custom_mensaje=(
                        f"ALERTA: Rama Judicial no responde.\n"
                        f"Lleva {_rama_fallos} intentos fallidos consecutivos.\n"
                        f"Los radicados no se estan sincronizando."
                    ),
                )
    return False


@router.post("/marcar-todo-leido")
@limiter.limit("30/minute")
def marcar_todo_leido(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Al leerse en la app, la novedad queda atendida: se detiene cualquier
    # reintento de notificacion pendiente para ese usuario.
    count = db.query(Proceso).filter(Proceso.notificado == False, Proceso.user_id == current_user.id).update(
        {
            Proceso.notificado: True,
            Proceso.notificacion_pendiente: False,
            Proceso.intentos_notificacion: 0,
        },
        synchronize_session=False,
    )
    db.commit()
    return {"ok": True, "marcados": count}
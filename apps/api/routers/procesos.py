import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from sqlalchemy.orm import Session
from models.database import get_db
from models.actuacion import Actuacion
from models.proceso import Proceso
from services.sync import sincronizar_radicados
from scraper.rama_client import buscar_por_radicado, buscar_detalle_proceso, buscar_actuaciones
from services.auth import get_current_user, oauth2_scheme
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
    skip: int = 0,
    limit: int = 10,
):
    query = db.query(Proceso).filter(Proceso.user_id == current_user.id)

    if despacho:
        query = query.filter(Proceso.despacho.ilike(f"%{despacho}%"))
    if departamento:
        query = query.filter(Proceso.departamento.ilike(f"%{departamento}%"))

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
                "fecha_proceso": p.fecha_proceso,
                "fecha_ultima_actuacion": p.fecha_ultima_actuacion,
                "notificado": p.notificado,
                "creado_en": p.creado_en,
                "actualizado_en": p.actualizado_en,
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
            }
            for p in procesos
        ],
    }


def _auth_for_sync(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Dependencia que permite usar un `API_TOKEN` (workflow/CI) o la autenticación normal.

    - Si `API_TOKEN` está configurado: el header `Authorization: Bearer <API_TOKEN>` autoriza la petición y se retorna `None`.
    - Si `API_TOKEN` está configurado y no coincide: se devuelve 401.
    - Si `API_TOKEN` está vacío: se usa la autenticación normal (token JWT) y se retorna el `User`.
    """
    auth_header = (request.headers.get("authorization") or "")
    # Si hay API_TOKEN configurado, permitir solo si coincide
    if API_TOKEN:
        if auth_header.startswith("Bearer "):
            token_value = auth_header.split(" ", 1)[1]
            if token_value == API_TOKEN:
                return None
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    # En desarrollo/local, usamos autenticación normal
    return get_current_user(token=token, db=db)


@router.post("/sync")
def sync_manual(db: Session = Depends(get_db), current_user: Optional[User] = Depends(_auth_for_sync)):
    # Si `current_user` es None significa que la petición vino con `API_TOKEN` válido — sincronizamos globalmente.
    if current_user is None:
        resultado = sincronizar_radicados(db)
    else:
        resultado = sincronizar_radicados(db, user_id=current_user.id)
    return resultado


class AddRadicado(BaseModel):
    llave_proceso: constr(pattern=r"^\d{23}$")
    despacho: Optional[str] = None
    departamento: Optional[str] = None
    sujetos_procesales: Optional[str] = None


@router.post("/add")
def add_radicado(payload: AddRadicado, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existente = db.query(Proceso).filter(Proceso.llave_proceso == payload.llave_proceso, Proceso.user_id == current_user.id).first()
    if existente:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Radicado ya existe")

    nuevo = Proceso(
        llave_proceso=payload.llave_proceso,
        despacho=payload.despacho or "",
        departamento=payload.departamento or "",
        sujetos_procesales=payload.sujetos_procesales or "",
        notificado=False,
        user_id=current_user.id,
    )
    db.add(nuevo)
    db.commit()

    try:
        resultado = buscar_por_radicado(payload.llave_proceso, solo_activos=False)
        if resultado.procesos:
            acts = buscar_actuaciones(resultado.procesos[0].id_proceso)
            ultima_fecha = None
            for a in acts.actuaciones:
                _upsert_actuacion(db, nuevo, a)
                if a.fecha_actuacion and (ultima_fecha is None or a.fecha_actuacion > ultima_fecha):
                    ultima_fecha = a.fecha_actuacion
            if ultima_fecha:
                nuevo.fecha_ultima_actuacion = ultima_fecha
            db.commit()
    except Exception as exc:
        logger.warning("Sync inicial falló para %s: %s", payload.llave_proceso, exc)
        db.rollback()

    return {"created": True, "llave_proceso": payload.llave_proceso}


@router.get("/options")
def opciones_filtros(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    despachos = [d[0] for d in db.query(Proceso.despacho).filter(Proceso.user_id == current_user.id).distinct().all() if d[0]]
    departamentos = [d[0] for d in db.query(Proceso.departamento).filter(Proceso.user_id == current_user.id).distinct().all() if d[0]]
    return {"despachos": sorted(list(set(despachos))), "departamentos": sorted(list(set(departamentos)))}


@router.get("/rama-health")
def rama_health():
    import httpx
    try:
        with httpx.Client(timeout=10, verify=False) as client:
            r = client.get("https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Procesos/Consulta/NumeroRadicacion", params={"numero": "05001310301720240048000", "soloActivos": "false", "pagina": 1})
            return {"status": r.status_code, "body_truncado": r.text[:500]}
    except Exception as exc:
        return {"status": "error", "error": repr(exc)}


@router.get("/diagnostico/{llave_proceso}")
def diagnosticar_rama(llave_proceso: str):
    resultados = {}

    try:
        busqueda = buscar_por_radicado(llave_proceso, solo_activos=False)
        resultados["busqueda"] = {
            "ok": True,
            "procesos": len(busqueda.procesos),
            "id_proceso": busqueda.procesos[0].id_proceso if busqueda.procesos else None,
        }
        if busqueda.procesos:
            id_proc = busqueda.procesos[0].id_proceso
            try:
                detalle = buscar_detalle_proceso(id_proc)
                resultados["detalle"] = {"ok": True, "despacho": detalle.despacho}
            except Exception as exc:
                resultados["detalle"] = {"ok": False, "error": str(exc)}

            try:
                acts = buscar_actuaciones(id_proc)
                resultados["actuaciones"] = {
                    "ok": True,
                    "total": acts.paginacion.cantidad_registros,
                    "traidas": len(acts.actuaciones),
                    "primera": {
                        "fecha": acts.actuaciones[0].fecha_actuacion,
                        "actuacion": acts.actuaciones[0].actuacion,
                    } if acts.actuaciones else None,
                }
            except Exception as exc:
                resultados["actuaciones"] = {"ok": False, "error": str(exc)}
    except Exception as exc:
        resultados["busqueda"] = {"ok": False, "error": str(exc)}

    return resultados


@router.get("/publico/{llave_proceso}")
def obtener_proceso_publico(llave_proceso: str):
    """Endpoint publico temporal para probar CORS desde el frontend."""
    try:
        busqueda = buscar_por_radicado(llave_proceso, solo_activos=False)
        if not busqueda.procesos:
            return {"actuaciones": []}
        acts = buscar_actuaciones(busqueda.procesos[0].id_proceso)
        return {
            "actuaciones": [
                {
                    "fecha_actuacion": a.fecha_actuacion,
                    "actuacion": a.actuacion,
                    "anotacion": a.anotacion,
                }
                for a in acts.actuaciones
            ]
        }
    except Exception as exc:
        return {"error": str(exc)}


def _sincronizar_radicado_actuaciones(db, proceso):
    # Skip if synced within last 30 minutes
    if proceso.actualizado_en and (datetime.now(timezone.utc) - proceso.actualizado_en).total_seconds() < 1800:
        return

    try:
        resultado = buscar_por_radicado(proceso.llave_proceso, solo_activos=False)
        if resultado.procesos:
            acts = buscar_actuaciones(resultado.procesos[0].id_proceso)
            ultima_fecha = None
            for a in acts.actuaciones:
                _upsert_actuacion(db, proceso, a)
                if a.fecha_actuacion and (ultima_fecha is None or a.fecha_actuacion > ultima_fecha):
                    ultima_fecha = a.fecha_actuacion
            if ultima_fecha:
                proceso.fecha_ultima_actuacion = ultima_fecha
        proceso.actualizado_en = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:
        logger.warning("Sync falló para %s: %s", proceso.llave_proceso, exc)
        db.rollback()


def _upsert_actuacion(db, proceso, remota):
    existente = db.query(Actuacion).filter(Actuacion.proceso_id == proceso.id, Actuacion.id_reg_actuacion == remota.id_reg_actuacion).first()
    if existente is None:
        existente = Actuacion(proceso_id=proceso.id, id_reg_actuacion=remota.id_reg_actuacion)
        db.add(existente)
    existente.cons_actuacion = remota.cons_actuacion
    existente.fecha_actuacion = remota.fecha_actuacion
    existente.actuacion = remota.actuacion
    existente.anotacion = remota.anotacion
    existente.fecha_inicial = remota.fecha_inicial
    existente.fecha_final = remota.fecha_final
    existente.fecha_registro = remota.fecha_registro
    existente.cod_regla = remota.cod_regla
    existente.con_documentos = bool(remota.con_documentos)
    existente.cant = remota.cant
    return existente


@router.get("/{llave_proceso}")
def obtener_proceso(llave_proceso: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso, Proceso.user_id == current_user.id).first()
    if not proceso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radicado no encontrado")

    _sincronizar_radicado_actuaciones(db, proceso)

    actuaciones = (
        db.query(Actuacion)
        .filter(Actuacion.proceso_id == proceso.id)
        .order_by(Actuacion.fecha_actuacion.desc().nullslast(), Actuacion.id_reg_actuacion.desc())
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
        "fecha_proceso": proceso.fecha_proceso,
        "fecha_ultima_actuacion": proceso.fecha_ultima_actuacion,
        "notificado": proceso.notificado,
        "creado_en": proceso.creado_en,
        "actualizado_en": proceso.actualizado_en,
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
    despacho: Optional[str] = None
    departamento: Optional[str] = None
    sujetos_procesales: Optional[str] = None
    notificado: Optional[bool] = None
    fecha_ultima_actuacion: Optional[str] = None


@router.delete("/{llave_proceso}")
def delete_proceso(llave_proceso: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso, Proceso.user_id == current_user.id).first()
    if not proceso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radicado no encontrado")
    db.delete(proceso)
    db.commit()
    return {"deleted": True, "llave_proceso": llave_proceso}


@router.patch("/{llave_proceso}")
def update_proceso(llave_proceso: str, payload: UpdateProceso, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso, Proceso.user_id == current_user.id).first()
    if not proceso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radicado no encontrado")

    changed = False
    if payload.despacho is not None:
        proceso.despacho = payload.despacho
        changed = True
    if payload.departamento is not None:
        proceso.departamento = payload.departamento
        changed = True
    if payload.sujetos_procesales is not None:
        proceso.sujetos_procesales = payload.sujetos_procesales
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

    return {"updated": changed, "llave_proceso": llave_proceso}
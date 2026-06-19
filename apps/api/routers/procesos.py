import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from models.database import get_db
from models.actuacion import Actuacion
from models.proceso import Proceso
from services.sync import sincronizar_radicados, sincronizar_radicados_lote, _elegir_usuario_para_sync
from services.sync_manager import iniciar_sync_global, obtener_resultado
from fastapi.responses import StreamingResponse
from scraper.rama_client import buscar_por_radicado, buscar_detalle_proceso, buscar_actuaciones, descargar_documento, rama_health_check
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
    categoria: str = Query(None),
    q: str = Query(None),
    skip: int = 0,
    limit: int = 10,
):
    query = db.query(Proceso).filter(Proceso.user_id == current_user.id)

    if despacho:
        query = query.filter(Proceso.despacho.ilike(f"%{despacho}%"))
    if departamento:
        query = query.filter(Proceso.departamento.ilike(f"%{departamento}%"))
    if categoria:
        query = query.filter(Proceso.categoria == categoria)
    if q:
        query = query.filter(Proceso.llave_proceso.ilike(f"%{q}%"))

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
        if auth_header.startswith("Bearer "):
            token_value = auth_header.split(" ", 1)[1]
            if token_value == API_TOKEN:
                return None
    return get_current_user(token=token, db=db)


@router.post("/sync")
def sync_manual(current_user: Optional[User] = Depends(_auth_for_sync)):
    if current_user is None:
        task_id = iniciar_sync_global()
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"task_id": task_id, "status": "started", "mensaje": "Sincronización iniciada en segundo plano"},
        )
    db = next(get_db())
    try:
        resultado = sincronizar_radicados_lote(db, lote=50, user_id=current_user.id)
        return resultado
    finally:
        db.close()


@router.get("/sync/{task_id}")
def sync_status(task_id: str):
    tarea = obtener_resultado(task_id)
    if tarea is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")
    return tarea


@router.post("/sync-lote")
def sync_lote(current_user: Optional[User] = Depends(_auth_for_sync), db: Session = Depends(get_db)):
    if not API_TOKEN:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="API_TOKEN no configurado")
    if not rama_health_check():
        return {"mensaje": "Rama Judicial no responde, se omite sync", "total_consultados": 0}
    user_id = _elegir_usuario_para_sync(db)
    if user_id is None:
        return {"mensaje": "No hay usuarios con radicados", "total_consultados": 0}
    resultado = sincronizar_radicados_lote(db, lote=25, user_id=user_id)
    resultado["usuario_sincronizado"] = user_id
    return resultado


class AddRadicado(BaseModel):
    llave_proceso: constr(pattern=r"^\d{23}$")
    despacho: Optional[str] = None
    departamento: Optional[str] = None
    sujetos_procesales: Optional[str] = None
    categoria: Optional[str] = None


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
def descargar_documento_endpoint(id_reg_documento: int, current_user: User = Depends(get_current_user)):
    from scraper.rama_client import descargar_documento as _descargar
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
    limit_actuaciones: int = Query(50, ge=1, le=200),
):
    procesos = (
        db.query(Proceso)
        .filter(Proceso.notificado == False, Proceso.user_id == current_user.id)
        .order_by(Proceso.fecha_ultima_actuacion.desc().nullslast(), Proceso.id.desc())
        .all()
    )

    return {
        "total": len(procesos),
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
                    for a in (
                        db.query(Actuacion)
                        .filter(Actuacion.proceso_id == p.id)
                        .order_by(Actuacion.fecha_actuacion.desc().nullslast(), Actuacion.id_reg_actuacion.desc())
                        .limit(limit_actuaciones)
                        .all()
                    )
                ],
            }
            for p in procesos
        ],
    }


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
    if proceso.ultima_sincronizacion and (datetime.utcnow() - proceso.ultima_sincronizacion).total_seconds() < 1800:
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
                dias_sin = (datetime.utcnow().date() - datetime.strptime(ultima_fecha[:10], "%Y-%m-%d").date()).days
                proceso.dias_sin_cambios = max(0, dias_sin)
        proceso.ultima_sincronizacion = datetime.utcnow()
        db.commit()
    except Exception as exc:
        logger.warning("Sync falló para %s: %s", proceso.llave_proceso, exc)
        db.rollback()


def _serializar_texto(valor: str | None) -> str | None:
    valor_normalizado = (valor or "").strip()
    return valor_normalizado or None


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
        "categoria": proceso.categoria,
        "fecha_proceso": proceso.fecha_proceso,
        "fecha_ultima_actuacion": proceso.fecha_ultima_actuacion,
        "notificado": proceso.notificado,
        "creado_en": proceso.creado_en,
        "actualizado_en": proceso.actualizado_en,
        "ultima_sincronizacion": proceso.ultima_sincronizacion,
        "dias_sin_cambios": proceso.dias_sin_cambios,
        "fallos_consecutivos": proceso.fallos_consecutivos,
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
    llave_proceso: Optional[str] = None
    despacho: Optional[str] = None
    departamento: Optional[str] = None
    sujetos_procesales: Optional[str] = None
    categoria: Optional[str] = None
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
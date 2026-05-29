from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from models.database import get_db
from models.proceso import Proceso
from services.sync import sincronizar_radicados

router = APIRouter(prefix="/procesos", tags=["procesos"])

from pydantic import BaseModel
from pydantic import constr
from typing import Optional

@router.get("/")
def listar_procesos(
    db: Session = Depends(get_db),
    despacho: str = Query(None),
    departamento: str = Query(None),
    skip: int = 0,
    limit: int = 10,
):
    query = db.query(Proceso)

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


@router.get("/{llave_proceso}")
def obtener_proceso(llave_proceso: str, db: Session = Depends(get_db)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso).first()
    if not proceso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radicado no encontrado")

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
    }

@router.get("/novedades")
def listar_novedades(db: Session = Depends(get_db)):
    procesos = db.query(Proceso).filter(Proceso.notificado == False).all()
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

@router.post("/sync")
def sync_manual(db: Session = Depends(get_db)):
    resultado = sincronizar_radicados(db)
    return resultado


class AddRadicado(BaseModel):
    llave_proceso: constr(pattern=r"^\d{23}$")
    despacho: Optional[str] = None
    departamento: Optional[str] = None
    sujetos_procesales: Optional[str] = None


@router.post("/add")
def add_radicado(payload: AddRadicado, db: Session = Depends(get_db)):
    existente = db.query(Proceso).filter(Proceso.llave_proceso == payload.llave_proceso).first()
    if existente:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Radicado ya existe")

    nuevo = Proceso(
        llave_proceso=payload.llave_proceso,
        despacho=payload.despacho or "",
        departamento=payload.departamento or "",
        sujetos_procesales=payload.sujetos_procesales or "",
        notificado=True,
    )
    db.add(nuevo)
    db.commit()
    return {"created": True, "llave_proceso": payload.llave_proceso}


@router.get("/options")
def opciones_filtros(db: Session = Depends(get_db)):
    despachos = [d[0] for d in db.query(Proceso.despacho).distinct().all() if d[0]]
    departamentos = [d[0] for d in db.query(Proceso.departamento).distinct().all() if d[0]]
    return {"despachos": sorted(list(set(despachos))), "departamentos": sorted(list(set(departamentos)))}


class UpdateProceso(BaseModel):
    despacho: Optional[str] = None
    departamento: Optional[str] = None
    sujetos_procesales: Optional[str] = None
    notificado: Optional[bool] = None
    fecha_ultima_actuacion: Optional[str] = None


@router.delete("/{llave_proceso}")
def delete_proceso(llave_proceso: str, db: Session = Depends(get_db)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso).first()
    if not proceso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radicado no encontrado")
    db.delete(proceso)
    db.commit()
    return {"deleted": True, "llave_proceso": llave_proceso}


@router.patch("/{llave_proceso}")
def update_proceso(llave_proceso: str, payload: UpdateProceso, db: Session = Depends(get_db)):
    proceso = db.query(Proceso).filter(Proceso.llave_proceso == llave_proceso).first()
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
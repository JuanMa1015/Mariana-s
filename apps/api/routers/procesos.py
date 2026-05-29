from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from models.database import get_db
from models.proceso import Proceso
from services.sync import sincronizar_procesos

router = APIRouter(prefix="/procesos", tags=["procesos"])

NOMBRE_MONITORADO = "Juan Manuel Londoño"

@router.get("/")
def listar_procesos(
    db: Session = Depends(get_db),
    despacho: str = Query(None),
    departamento: str = Query(None),
    skip: int = 0,
    limit: int = 50,
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
        "procesos": [
            {
                "llave_proceso": p.llave_proceso,
                "despacho": p.despacho,
                "departamento": p.departamento,
                "sujetos_procesales": p.sujetos_procesales,
                "tipo_proceso": p.tipo_proceso,
                "fecha_ultima_actuacion": p.fecha_ultima_actuacion,
                "notificado": p.notificado,
                "creado_en": p.creado_en,
            }
            for p in procesos
        ],
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
    resultado = sincronizar_procesos(NOMBRE_MONITORADO, db)
    return resultado
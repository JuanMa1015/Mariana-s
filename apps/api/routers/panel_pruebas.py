"""Pruebas y diagnostico del sistema, solo para administradores (ver services/pruebas.py)."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.database import get_db
from models.user import User
from routers.panel_admin import requiere_admin
from services import pruebas
from services.auditoria import auditar
from services.limiter import limiter

router = APIRouter(prefix="/panel/pruebas", tags=["panel-pruebas"])


class EjecutarPrueba(BaseModel):
    parametros: dict[str, Any] = {}


@router.get("")
@limiter.limit("60/minute")
def catalogo(request: Request, admin: User = Depends(requiere_admin)):
    return {
        "pruebas": [
            {
                "id": pid,
                "nombre": m["nombre"],
                "descripcion": m["descripcion"],
                "parametros": [{**p, "defecto": admin.id if p["defecto"] == "@admin" and p["tipo"] == "usuario" else admin.email if p["defecto"] == "@admin" else p["defecto"]} for p in m["parametros"]],
            }
            for pid, m in pruebas.CATALOGO.items()
        ]
    }


@router.post("/todas")
@limiter.limit("5/minute")
def ejecutar_todas(request: Request, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    """Corre todas las pruebas en modo seguro: no envia correos, push ni mensajes reales."""
    resultados = [pruebas.ejecutar(pid, db, admin, m.get("en_todas")) for pid, m in pruebas.CATALOGO.items()]
    estado = "fallo" if any(r["estado"] == "fallo" for r in resultados) else "aviso" if any(r["estado"] == "aviso" for r in resultados) else "ok"
    auditar(db, admin, "prueba.todas", None, estado)
    return {"estado": estado, "resultados": resultados}


@router.post("/{prueba_id}")
@limiter.limit("20/minute")
def ejecutar_una(request: Request, prueba_id: str, payload: EjecutarPrueba, db: Session = Depends(get_db), admin: User = Depends(requiere_admin)):
    if prueba_id not in pruebas.CATALOGO:
        raise HTTPException(status_code=404, detail="Prueba no encontrada")
    resultado = pruebas.ejecutar(prueba_id, db, admin, payload.parametros)
    auditar(db, admin, "prueba.ejecutar", prueba_id, resultado["estado"])
    return resultado

import time
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session

from models.database import get_db
from models.dispositivo import Dispositivo
from models.user import User
from services.auth import get_current_user
from services import push
from services.limiter import limiter

router = APIRouter(prefix="/dispositivos", tags=["dispositivos"])


class RegistroDispositivo(BaseModel):
    token: constr(min_length=20, max_length=4096)
    plataforma: Literal["android", "ios"] = "android"


class BajaDispositivo(BaseModel):
    token: constr(min_length=20, max_length=4096)


@router.post("/")
@limiter.limit("30/minute")
def registrar_dispositivo(
    request: Request,
    payload: RegistroDispositivo,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra (o reasigna) el token push de este celular al usuario autenticado."""
    d = db.query(Dispositivo).filter(Dispositivo.token == payload.token).first()
    if d:
        d.user_id = current_user.id
        d.plataforma = payload.plataforma
    else:
        db.add(Dispositivo(user_id=current_user.id, token=payload.token, plataforma=payload.plataforma))
    db.commit()
    return {"registered": True}


@router.post("/baja")
@limiter.limit("30/minute")
def dar_de_baja_dispositivo(
    request: Request,
    payload: BajaDispositivo,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deja de enviar push a este celular (cierre de sesion). El token va en el body, no en la URL."""
    borrados = (
        db.query(Dispositivo)
        .filter(Dispositivo.token == payload.token, Dispositivo.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"removed": borrados > 0}


@router.post("/prueba")
@limiter.limit("5/minute")
def enviar_aviso_de_prueba(
    request: Request,
    tareas: BackgroundTasks,
    demora: int = Query(0, ge=0, le=60, description="Segundos de espera antes de enviar (para cerrar la app y probar con ella cerrada)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Simula una novedad: envia un push de ejemplo a los celulares del usuario.

    Usa el mismo camino que un aviso real. Si el usuario tiene procesos, el aviso
    apunta al mas reciente para probar tambien el toque que abre el detalle.
    """
    if not push.habilitado():
        raise HTTPException(status_code=503, detail="Las notificaciones push no están configuradas en el servidor")
    if not db.query(Dispositivo).filter(Dispositivo.user_id == current_user.id).count():
        raise HTTPException(status_code=409, detail="No hay celulares registrados. Activa los avisos en la app primero")
    titulo, cuerpo, llave = push.ejemplo_de_aviso(db, current_user.id)
    if demora:
        # Con demora, el aviso sale despues de responder: da tiempo de cerrar la app antes de que llegue
        tareas.add_task(_enviar_tras_espera, demora, current_user.id, titulo, cuerpo, llave)
        return {"enviados": 0, "programado_en": demora}
    res = push.notificar_usuario_detalle(current_user.id, titulo, cuerpo, llave, tag="prueba")
    return {"enviados": res.aceptados, "errores": res.errores, "caducados": len(res.tokens_invalidos)}


def _enviar_tras_espera(segundos: int, user_id: int, titulo: str, cuerpo: str, llave: str | None) -> None:
    time.sleep(segundos)
    push.notificar_usuario(user_id, titulo, cuerpo, llave, tag="prueba")

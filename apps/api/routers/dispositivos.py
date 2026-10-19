from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session

from models.database import get_db
from models.dispositivo import Dispositivo
from models.user import User
from services.auth import get_current_user
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

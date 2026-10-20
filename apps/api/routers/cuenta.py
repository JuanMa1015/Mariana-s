import base64
import binascii
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.database import get_db
from models.user import User
from services import password_reset
from services.auth import get_current_user, verify_password
from services.limiter import limiter

router = APIRouter(prefix="/cuenta", tags=["cuenta"])

AVATAR_MAX_BYTES = 300 * 1024  # la app lo reduce a ~256px antes de subirlo
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,30}$")


def _mime_imagen(datos: bytes) -> str | None:
    """Detecta el tipo real por los bytes iniciales (no se confia en el Content-Type del cliente)."""
    if datos.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if datos.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return "image/webp"
    return None


def _enmascarar(email: str) -> str:
    local, _, dominio = email.partition("@")
    return f"{local[:1]}{'*' * max(len(local) - 1, 2)}@{dominio}"


class CambioUsername(BaseModel):
    username: str
    password: str


@router.post("/usuario")
@limiter.limit("5/minute")
def cambiar_usuario(
    request: Request,
    payload: CambioUsername,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambia el nombre de usuario; exige la contraseña actual."""
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña no es correcta")
    nuevo = payload.username.strip()
    if not _USERNAME_RE.fullmatch(nuevo):
        raise HTTPException(status_code=400, detail="Usa de 3 a 30 caracteres: letras, números, punto o guion bajo")
    ocupado = (
        db.query(User)
        .filter(func.lower(User.username) == nuevo.lower(), User.id != current_user.id)
        .first()
    )
    if ocupado:
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está en uso")
    current_user.username = nuevo
    db.commit()
    return {"username": nuevo}


class SubidaAvatar(BaseModel):
    imagen: str  # base64 de la imagen (JPEG/PNG/WebP, hasta 300 KB ya decodificada)


@router.put("/avatar")
@limiter.limit("10/minute")
def subir_avatar(
    request: Request,
    payload: SubidaAvatar,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Foto de perfil. Va en base64 dentro de JSON: asi funciona igual en la web y en el HTTP nativo de la app."""
    if len(payload.imagen) > AVATAR_MAX_BYTES * 4 // 3 + 16:
        raise HTTPException(status_code=413, detail="La imagen es demasiado grande (máximo 300 KB)")
    try:
        datos = base64.b64decode(payload.imagen, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Imagen inválida")
    if len(datos) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=413, detail="La imagen es demasiado grande (máximo 300 KB)")
    mime = _mime_imagen(datos)
    if not mime:
        raise HTTPException(status_code=415, detail="Formato no soportado: usa JPEG, PNG o WebP")
    current_user.avatar = datos
    current_user.avatar_mime = mime
    db.commit()
    return {"ok": True}


@router.get("/avatar")
def obtener_avatar(current_user: User = Depends(get_current_user)):
    if not current_user.avatar_mime:
        raise HTTPException(status_code=404, detail="Sin foto de perfil")
    codificada = base64.b64encode(current_user.avatar).decode("ascii")
    return JSONResponse(
        {"data_url": f"data:{current_user.avatar_mime};base64,{codificada}"},
        headers={"Cache-Control": "private, no-store"},
    )


@router.delete("/avatar")
def borrar_avatar(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.avatar = None
    current_user.avatar_mime = None
    db.commit()
    return {"ok": True}


@router.post("/password/solicitar")
@limiter.limit("3/hour")
def solicitar_cambio_password(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envia al correo de la cuenta el enlace para elegir una nueva contraseña."""
    estado = password_reset.enviar_enlace(db, current_user)
    if estado == "espera":
        raise HTTPException(status_code=429, detail="Ya enviamos un enlace hace un momento. Revisa tu correo o espera un minuto.")
    if estado == "error":
        raise HTTPException(status_code=503, detail="No pudimos enviar el correo ahora. Inténtalo de nuevo en unos minutos.")
    return {"ok": True, "email": _enmascarar(current_user.email)}

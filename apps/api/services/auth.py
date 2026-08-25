import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status, Response
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from models.database import get_db
from models.user import User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

COOKIE_NAME = "access_token"

# Chequeo de contraseñas filtradas via Pwned Passwords (k-anonymity).
# Desactivable con HIBP_CHECK=false (p. ej. en tests sin red).
HIBP_CHECK_ENABLED = os.getenv("HIBP_CHECK", "true").lower() == "true"


def password_en_filtraciones(password: str) -> bool:
    """True si la contraseña aparece en brechas publicas conocidas.

    Usa el modelo k-anonymity de HIBP: solo se envian los primeros 5
    caracteres del SHA-1. Ante un fallo de red devuelve False (fail-open)
    para no dejar el registro inaccesible si el servicio externo cae.
    """
    if not HIBP_CHECK_ENABLED:
        return False
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefijo, sufijo = sha1[:5], sha1[5:]
    try:
        resp = httpx.get(f"https://api.pwnedpasswords.com/range/{prefijo}", timeout=5.0)
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("HIBP indisponible (%s); se omite chequeo de contrasenas filtradas", exc)
        return False
    for linea in resp.text.splitlines():
        partes = linea.strip().split(":")
        if len(partes) == 2 and partes[0] == sufijo:
            try:
                if int(partes[1]) > 0:
                    return True
            except ValueError:
                continue
    return False


def _decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
    )


def get_password_hash(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def set_token_cookie(response: Response, token: str):
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_token_cookie(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="none",
        secure=True,
    )


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    raw_token = token
    if not raw_token:
        raw_token = request.cookies.get(COOKIE_NAME)

    if not raw_token:
        raise credentials_exception

    payload = _decode_token(raw_token)
    if payload is None:
        raise credentials_exception

    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    # Revocacion: si el token trae version y no coincide con la actual del
    # usuario (logout incrementa token_version), el token queda invalidado.
    # Tokens sin "ver" (emitidos antes del cambio) se aceptan por compatibilidad.
    version_token = payload.get("ver")
    if (
        version_token is not None
        and user.token_version is not None
        and version_token != user.token_version
    ):
        raise credentials_exception

    return user

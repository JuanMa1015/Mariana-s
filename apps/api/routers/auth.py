import re
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from models.database import get_db
from models.user import User
from services.auth import verify_password, get_password_hash, create_access_token
from config import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["auth"])

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: str | None = None

class UserLogin(BaseModel):
    credential: str
    password: str


def _generar_username(base: str, db: Session) -> str:
    username = re.sub(r"[^a-zA-Z0-9_]", "", base.split("@")[0])
    if not username:
        username = "user"
    original = username
    contador = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{original}{contador}"
        contador += 1
    return username


@router.post("/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    username = user.username or _generar_username(user.email, db)

    hashed_password = get_password_hash(user.password)
    new_user = User(email=user.email, username=username, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "email": new_user.email,
        "username": new_user.username,
    }


@router.post("/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    credential = user.credential.strip()

    if "@" in credential:
        db_user = db.query(User).filter(User.email == credential).first()
    else:
        db_user = db.query(User).filter(User.username == credential).first()

    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo/usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "email": db_user.email,
        "username": db_user.username,
    }

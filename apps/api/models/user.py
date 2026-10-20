from sqlalchemy import Column, String, Integer, DateTime, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, deferred
from models.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    telegram_chat_id = Column(String, nullable=True)
    # Foto de perfil (<=300 KB): deferred para no cargar el binario en cada consulta de usuario
    avatar = deferred(Column(LargeBinary, nullable=True))
    avatar_mime = Column(String(20), nullable=True)
    # Se incrementa en logout para invalidar tokens emitidos con versiones previas
    token_version = Column(Integer, nullable=False, server_default="1", default=1)

    procesos = relationship("Proceso", back_populates="user", cascade="all, delete")

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.database import Base


class Dispositivo(Base):
    """Token de notificaciones push (FCM) de un celular de un usuario."""

    __tablename__ = "dispositivos"
    __table_args__ = (Index("ix_dispositivos_user_id", "user_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Un token pertenece a un solo usuario a la vez: al iniciar sesion otra cuenta se reasigna
    token = Column(String, unique=True, nullable=False)
    plataforma = Column(String(10), nullable=False, default="android")
    creado_en = Column(DateTime, server_default=func.now())
    ultimo_uso = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User")

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.database import Base

class Proceso(Base):
    __tablename__ = "procesos"
    __table_args__ = (UniqueConstraint('user_id', 'llave_proceso', name='uix_user_radicado'),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    llave_proceso = Column(String, index=True, nullable=False)
    despacho = Column(String)
    departamento = Column(String)
    sujetos_procesales = Column(String)
    tipo_proceso = Column(String)
    clase_proceso = Column(String)
    es_privado = Column(Boolean, default=False)
    fecha_proceso = Column(String)
    fecha_ultima_actuacion = Column(String)
    notificado = Column(Boolean, default=False)
    tipo_novedad = Column(String, default="nuevo")
    categoria = Column(String, default="General")
    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, onupdate=func.now())

    user = relationship("User", back_populates="procesos")
    actuaciones = relationship("Actuacion", back_populates="proceso", cascade="all, delete-orphan")
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.sql import func
from models.database import Base

class Proceso(Base):
    __tablename__ = "procesos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    llave_proceso = Column(String, unique=True, index=True, nullable=False)
    despacho = Column(String)
    departamento = Column(String)
    sujetos_procesales = Column(String)
    tipo_proceso = Column(String)
    clase_proceso = Column(String)
    es_privado = Column(Boolean, default=False)
    fecha_proceso = Column(String)
    fecha_ultima_actuacion = Column(String)
    notificado = Column(Boolean, default=False)
    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, onupdate=func.now())
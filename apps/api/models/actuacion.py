from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from models.database import Base


class Actuacion(Base):
    __tablename__ = "actuaciones"
    __table_args__ = (UniqueConstraint("proceso_id", "id_reg_actuacion", name="uix_proceso_actuacion"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    proceso_id = Column(Integer, ForeignKey("procesos.id"), nullable=False, index=True)
    id_reg_actuacion = Column(BigInteger, nullable=False, index=True)
    cons_actuacion = Column(BigInteger, nullable=False)
    fecha_actuacion = Column(String)
    actuacion = Column(String)
    anotacion = Column(Text)
    fecha_inicial = Column(String)
    fecha_final = Column(String)
    fecha_registro = Column(String)
    cod_regla = Column(String)
    con_documentos = Column(Boolean, default=False)
    cant = Column(Integer)
    creado_en = Column(DateTime, server_default=func.now())

    proceso = relationship("Proceso", back_populates="actuaciones")
    documentos = relationship("DocumentoActuacion", back_populates="actuacion_rel", cascade="all, delete-orphan")
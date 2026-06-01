from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from models.database import Base


class DocumentoActuacion(Base):
    __tablename__ = "documentos_actuacion"
    __table_args__ = (UniqueConstraint("actuacion_id", "id_reg_documento", name="uix_actuacion_documento"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    actuacion_id = Column(Integer, ForeignKey("actuaciones.id"), nullable=False, index=True)
    id_reg_documento = Column(Integer, nullable=False, index=True)
    id_conexion = Column(Integer)
    cons_actuacion = Column(Integer)
    guid_documento_sxxiw = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    descripcion = Column(Text)
    tipo = Column(String)
    fecha_carga = Column(String)
    creado_en = Column(DateTime, server_default=func.now())

    actuacion_rel = relationship("Actuacion", back_populates="documentos")
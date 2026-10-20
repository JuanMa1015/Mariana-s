from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from models.database import Base


class AuditLog(Base):
    """Registro de lo que hacen los administradores desde el panel (quien, que, sobre que, cuando)."""

    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_log_creado_en", "creado_en"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Se conserva el correo aunque el admin se elimine despues (por eso SET NULL y copia del correo)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    admin_email = Column(String, nullable=False)
    accion = Column(String(60), nullable=False)
    objetivo = Column(String(200), nullable=True)
    detalle = Column(Text, nullable=True)
    creado_en = Column(DateTime, server_default=func.now(), nullable=False)

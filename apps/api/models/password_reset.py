from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from models.database import Base


class PasswordReset(Base):
    """Token de un solo uso para restablecer la contraseña. Solo se guarda su hash (SHA-256)."""

    __tablename__ = "password_resets"
    __table_args__ = (Index("ix_password_resets_user_id", "user_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False)
    creado_en = Column(DateTime, server_default=func.now(), nullable=False)
    expira_en = Column(DateTime, nullable=False)
    usado_en = Column(DateTime, nullable=True)

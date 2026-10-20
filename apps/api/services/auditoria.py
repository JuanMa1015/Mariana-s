from sqlalchemy.orm import Session

from models.audit_log import AuditLog
from models.user import User


def auditar(db: Session, admin: User, accion: str, objetivo: str | None = None, detalle: str | None = None) -> None:
    """Deja constancia de una accion de administracion (quien, que, sobre que)."""
    db.add(AuditLog(admin_id=admin.id, admin_email=admin.email, accion=accion, objetivo=(objetivo or "")[:200], detalle=detalle))
    db.commit()

from models.database import Base, engine
from models import proceso, user, actuacion, documento_actuacion

def init_db():
    Base.metadata.create_all(bind=engine)

    # Migrate Integer columns to BigInteger (PostgreSQL: existing table has Integer, need BIGINT for large id_reg_actuacion)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE actuaciones ALTER COLUMN id_reg_actuacion TYPE BIGINT"))
            conn.execute(text("ALTER TABLE actuaciones ALTER COLUMN cons_actuacion TYPE BIGINT"))
            conn.commit()
    except Exception:
        pass  # SQLite doesn't support ALTER COLUMN TYPE; ignore

    # Migrate documentos_actuacion columns to BigInteger
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE documentos_actuacion ALTER COLUMN id_reg_documento TYPE BIGINT"))
            conn.execute(text("ALTER TABLE documentos_actuacion ALTER COLUMN cons_actuacion TYPE BIGINT"))
            conn.commit()
    except Exception:
        pass

    # Migrate: allow NULL in guid_documento_sxxiw (Rama Judicial sometimes returns null)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE documentos_actuacion ALTER COLUMN guid_documento_sxxiw DROP NOT NULL"))
            conn.commit()
    except Exception:
        pass

    # Migrate: add categoria column if missing
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE procesos ADD COLUMN categoria VARCHAR DEFAULT 'General'"))
            conn.commit()
    except Exception:
        pass  # Column already exists or not supported
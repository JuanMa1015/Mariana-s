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
from models import init_db
from models.database import SessionLocal
from models.proceso import Proceso

init_db()

db = SessionLocal()
total = db.query(Proceso).count()
print(f"Tabla creada. Procesos en BD: {total}")
db.close()
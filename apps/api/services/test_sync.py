from models import init_db
from models.database import SessionLocal
from services.sync import sincronizar_procesos

init_db()
db = SessionLocal()

resultado = sincronizar_procesos("Juan Manuel Londoño", db)
print(f"Total consultados: {resultado['total_consultados']}")
print(f"Nuevos: {resultado['nuevos']}")
print(f"Actualizados: {resultado['actualizados']}")

db.close()
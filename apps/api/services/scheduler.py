import logging
from apscheduler.schedulers.background import BackgroundScheduler
from models import init_db
from models.database import SessionLocal
from services.sync import sincronizar_procesos

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from config import NOMBRE_MONITORADO
NOMBRES_A_MONITOREAR = [NOMBRE_MONITORADO]

def job_sincronizar():
    logger.info("Iniciando sincronización automática...")
    db = SessionLocal()
    try:
        for nombre in NOMBRES_A_MONITOREAR:
            resultado = sincronizar_procesos(nombre, db)
            logger.info(
                f"[{nombre}] Total: {resultado['total_consultados']} | "
                f"Nuevos: {resultado['nuevos']} | "
                f"Actualizados: {resultado['actualizados']}"
            )
    except Exception as e:
        logger.error(f"Error en sincronización: {e}")
    finally:
        db.close()

def iniciar_scheduler(intervalo_horas: int = 6):
    init_db()
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        job_sincronizar,
        trigger="interval",
        hours=intervalo_horas,
        id="sync_procesos",
    )
    scheduler.start()
    logger.info(f"Scheduler iniciado — sincronizando cada {intervalo_horas} horas")
    return scheduler
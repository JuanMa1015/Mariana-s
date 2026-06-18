import logging
from apscheduler.schedulers.background import BackgroundScheduler
from models import init_db
from models.database import SessionLocal
from services.sync import sincronizar_radicados_lote
from scraper.rama_client import rama_health_check

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LOTE_POR_CICLO = 25

def job_sincronizar():
    logger.info("Verificando estado de Rama Judicial...")
    if not rama_health_check():
        logger.warning("Rama Judicial no responde. Se omite este ciclo.")
        return

    logger.info("Rama Judicial operativo. Iniciando sincronización por lotes...")
    db = SessionLocal()
    try:
        resultado = sincronizar_radicados_lote(db, lote=LOTE_POR_CICLO)
        logger.info(
            f"Lote procesado: {resultado['total_consultados']} | "
            f"Nuevos: {resultado['nuevos']} | "
            f"Actualizados: {resultado['actualizados']} | "
            f"Emails: {len(resultado['emails_enviados'])} | "
            f"Saltados (pronto): {len(resultado['radicados_saltados_frecuencia'])}"
        )
    except Exception as e:
        logger.error(f"Error en sincronización por lotes: {e}")
    finally:
        db.close()

def iniciar_scheduler(intervalo_horas: int = 1):
    init_db()
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        job_sincronizar,
        trigger="interval",
        hours=intervalo_horas,
        id="sync_procesos_lote",
    )
    scheduler.start()
    logger.info(f"Scheduler iniciado — sincronizando lote de {LOTE_POR_CICLO} radicados cada {intervalo_horas} hora(s)")
    return scheduler
import logging
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from models import init_db
from models.database import SessionLocal
from services.sync import sincronizar_radicados_lote
from scraper.rama_client import rama_health_check

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LOTE_POR_CICLO = 25
_scheduler_instance: BackgroundScheduler | None = None
_last_sync: dict = {
    "ultima_ejecucion": None,
    "ultimo_resultado": None,
    "ultimo_error": None,
}

def job_sincronizar():
    global _last_sync
    _last_sync["ultima_ejecucion"] = datetime.now(timezone.utc).isoformat()
    _last_sync["ultimo_error"] = None

    logger.info("Verificando estado de Rama Judicial...")
    rama_ok = rama_health_check()
    _last_sync["rama_ok"] = rama_ok
    if not rama_ok:
        logger.warning("Rama Judicial no responde. Se omite este ciclo.")
        _last_sync["ultimo_resultado"] = "saltado_rama_caido"
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
        _last_sync["ultimo_resultado"] = "exitoso"
        _last_sync["total_consultados"] = resultado.get("total_consultados", 0)
        _last_sync["nuevos"] = resultado.get("nuevos", 0)
        _last_sync["actualizados"] = resultado.get("actualizados", 0)
    except Exception as e:
        logger.error(f"Error en sincronización por lotes: {e}")
        _last_sync["ultimo_resultado"] = "error"
        _last_sync["ultimo_error"] = f"{type(e).__name__}: {e}"
    finally:
        db.close()

def iniciar_scheduler(intervalo_horas: int = 1):
    global _scheduler_instance
    init_db()
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        job_sincronizar,
        trigger="interval",
        hours=intervalo_horas,
        id="sync_procesos_lote",
    )
    scheduler.start()
    _scheduler_instance = scheduler
    logger.info(f"Scheduler iniciado — sincronizando lote de {LOTE_POR_CICLO} radicados cada {intervalo_horas} hora(s)")
    return scheduler


def obtener_estado_scheduler() -> dict:
    global _scheduler_instance, _last_sync
    return {
        "activo": _scheduler_instance is not None and _scheduler_instance.running,
        "ultima_sync": _last_sync,
    }
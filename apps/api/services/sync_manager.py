import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import datetime, timezone

import httpx
from sqlalchemy.exc import OperationalError
from config import API_URL
from models.database import SessionLocal
from services.sync import sincronizar_radicados
from scraper.rama_client import rama_health_check

logger = logging.getLogger(__name__)

_tasks: dict[str, dict] = {}
_lock = threading.Lock()

SYNC_TIMEOUT_MINUTES = 25


def _keepalive_loop(stop_event: threading.Event, interval_s: int = 240, url: str = ""):
    while not stop_event.is_set():
        if stop_event.wait(interval_s):
            break
        if not url:
            continue
        try:
            httpx.get(url, timeout=10)
        except Exception:
            pass


def iniciar_sync_global() -> str:
    task_id = uuid.uuid4().hex[:12]
    stop_event = threading.Event()

    with _lock:
        _tasks[task_id] = {
            "task_id": task_id,
            "status": "running",
            "started_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "finished_at": None,
            "result": None,
            "error": None,
        }

    def _run():
        if not rama_health_check():
            logger.warning("Rama Judicial no responde. Sync cancelado.")
            with _lock:
                _tasks[task_id].update({
                    "status": "failed",
                    "finished_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                    "error": "Rama Judicial no responde",
                })
            return

        db = SessionLocal()
        keepalive_url = f"{API_URL.rstrip('/')}/health" if API_URL else ""

        ka_thread = threading.Thread(
            target=_keepalive_loop,
            args=(stop_event, 240, keepalive_url),
            daemon=True,
        )
        ka_thread.start()

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(sincronizar_radicados, db)
                try:
                    resultado = future.result(timeout=SYNC_TIMEOUT_MINUTES * 60)
                    with _lock:
                        _tasks[task_id].update({
                            "status": "completed",
                            "finished_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                            "result": resultado,
                        })
                except TimeoutError:
                    logger.error("Sync global excedió el timeout de %d minutos", SYNC_TIMEOUT_MINUTES)
                    with _lock:
                        _tasks[task_id].update({
                            "status": "failed",
                            "finished_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                            "error": f"TimeoutError: Sync excedió {SYNC_TIMEOUT_MINUTES} minutos",
                        })
        except OperationalError:
            logger.warning("Error de conexión BD, reintentando una vez...")
            db.close()
            time.sleep(5)
            db = SessionLocal()
            try:
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(sincronizar_radicados, db)
                    resultado = future.result(timeout=SYNC_TIMEOUT_MINUTES * 60)
                    with _lock:
                        _tasks[task_id].update({
                            "status": "completed",
                            "finished_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                            "result": resultado,
                        })
            except TimeoutError:
                logger.error("Sync global excedió el timeout en reintento")
                with _lock:
                    _tasks[task_id].update({
                        "status": "failed",
                        "finished_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                        "error": f"TimeoutError: Sync excedió {SYNC_TIMEOUT_MINUTES} minutos (reintento)",
                    })
            except Exception as exc:
                logger.exception("Sync global falló (segundo intento): %s", exc)
                with _lock:
                    _tasks[task_id].update({
                        "status": "failed",
                        "finished_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                        "error": f"{type(exc).__name__}: {exc}",
                    })
        except Exception as exc:
            logger.exception("Sync global falló: %s", exc)
            with _lock:
                _tasks[task_id].update({
                    "status": "failed",
                    "finished_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                    "error": f"{type(exc).__name__}: {exc}",
                })
        finally:
            stop_event.set()
            db.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    return task_id


def obtener_resultado(task_id: str) -> dict | None:
    with _lock:
        return _tasks.get(task_id)


def sync_global_sync() -> dict:
    if not rama_health_check():
        return {"error": "Rama Judicial no responde", "total_consultados": 0, "nuevos": 0, "actualizados": 0}
    db = SessionLocal()
    try:
        return sincronizar_radicados(db)
    finally:
        db.close()

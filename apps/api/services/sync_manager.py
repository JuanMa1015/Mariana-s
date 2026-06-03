import logging
import threading
import time
import uuid
from datetime import datetime

import httpx
from sqlalchemy.exc import OperationalError
from config import API_URL
from models.database import SessionLocal
from services.sync import sincronizar_radicados

logger = logging.getLogger(__name__)

_tasks: dict[str, dict] = {}
_lock = threading.Lock()


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
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": None,
            "result": None,
            "error": None,
        }

    def _run():
        db = SessionLocal()
        keepalive_url = f"{API_URL.rstrip('/')}/health" if API_URL else ""

        ka_thread = threading.Thread(
            target=_keepalive_loop,
            args=(stop_event, 240, keepalive_url),
            daemon=True,
        )
        ka_thread.start()

        try:
            resultado = sincronizar_radicados(db)
            with _lock:
                _tasks[task_id].update({
                    "status": "completed",
                    "finished_at": datetime.utcnow().isoformat(),
                    "result": resultado,
                })
        except OperationalError:
            logger.warning("Error de conexión BD, reintentando una vez...")
            db.close()
            time.sleep(5)
            db = SessionLocal()
            try:
                resultado = sincronizar_radicados(db)
                with _lock:
                    _tasks[task_id].update({
                        "status": "completed",
                        "finished_at": datetime.utcnow().isoformat(),
                        "result": resultado,
                    })
            except Exception as exc:
                logger.exception("Sync global falló (segundo intento): %s", exc)
                with _lock:
                    _tasks[task_id].update({
                        "status": "failed",
                        "finished_at": datetime.utcnow().isoformat(),
                        "error": f"{type(exc).__name__}: {exc}",
                    })
        except Exception as exc:
            logger.exception("Sync global falló: %s", exc)
            with _lock:
                _tasks[task_id].update({
                    "status": "failed",
                    "finished_at": datetime.utcnow().isoformat(),
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
    db = SessionLocal()
    try:
        return sincronizar_radicados(db)
    finally:
        db.close()

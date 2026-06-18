import logging
import threading
import time

import httpx
from config import API_URL

logger = logging.getLogger(__name__)

_INTERVALO_SEGUNDOS = 300  # 5 minutos


def _loop_keepalive(stop_event: threading.Event, url: str):
    while not stop_event.is_set():
        if stop_event.wait(_INTERVALO_SEGUNDOS):
            break
        if not url:
            continue
        try:
            httpx.get(url, timeout=10)
            logger.debug("Keepalive enviado a %s", url)
        except Exception:
            pass


class Keepalive:
    def __init__(self):
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def iniciar(self):
        url = f"{API_URL.rstrip('/')}/health" if API_URL else ""
        if not url:
            logger.warning("API_URL no configurada, keepalive desactivado")
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=_loop_keepalive,
            args=(self._stop, url),
            daemon=True,
        )
        self._thread.start()
        logger.info("Keepalive iniciado — cada %ds a %s", _INTERVALO_SEGUNDOS, url)

    def detener(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)
        logger.info("Keepalive detenido")

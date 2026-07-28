import asyncio
import logging

import httpx
from config import API_URL

logger = logging.getLogger(__name__)

_INTERVALO_SEGUNDOS = 300


class Keepalive:
    def __init__(self):
        self._task: asyncio.Task | None = None

    def iniciar(self):
        url = f"{API_URL.rstrip('/')}/health" if API_URL else ""
        if not url:
            logger.warning("API_URL no configurada, keepalive desactivado")
            return
        self._task = asyncio.create_task(_loop_keepalive(url))
        logger.info("Keepalive iniciado — cada %ds a %s", _INTERVALO_SEGUNDOS, url)

    def detener(self):
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("Keepalive detenido")


async def _loop_keepalive(url: str):
    while True:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.get(url)
            logger.debug("Keepalive enviado a %s", url)
        except asyncio.CancelledError:
            break
        except Exception:
            pass
        await asyncio.sleep(_INTERVALO_SEGUNDOS)

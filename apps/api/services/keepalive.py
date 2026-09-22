import asyncio
import logging
import os

import httpx
from config import API_URL

logger = logging.getLogger(__name__)

# Nota: el keepalive pega a /healthz (sin consulta a la BD) para mantener
# despierto a Render sin gastar CU-hours de Neon. No usar /health aqui: su
# SELECT 1 impide que el compute de Neon duerma con el autosuspend.
_INTERVALO_SEGUNDOS = int(os.getenv("KEEPALIVE_INTERVAL_SECONDS", "300"))


class Keepalive:
    def __init__(self):
        self._task: asyncio.Task | None = None

    def iniciar(self):
        url = f"{API_URL.rstrip('/')}/healthz" if API_URL else ""
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

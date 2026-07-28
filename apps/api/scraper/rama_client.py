from __future__ import annotations

import logging
import time
from typing import Optional

import httpx

from scraper.types import (
    Proceso,
    Paginacion,
    ResultadoBusqueda,
    ResultadoActuaciones,
    DetalleProceso,
    DocumentoActuacion,
    Actuacion,
    parsear_proceso,
    parsear_detalle,
    parsear_actuacion,
    parsear_documento,
)
from config import RAMA_VERIFY_SSL

logger = logging.getLogger(__name__)

# Re-export types for backward compatibility
__all__ = [
    "Proceso",
    "Paginacion",
    "ResultadoBusqueda",
    "ResultadoActuaciones",
    "DetalleProceso",
    "DocumentoActuacion",
    "Actuacion",
    "buscar_por_nombre",
    "buscar_por_radicado",
    "buscar_detalle_proceso",
    "buscar_actuaciones",
    "buscar_documentos_actuacion",
    "descargar_documento",
    "rama_health_check",
]

TIMEOUT = httpx.Timeout(120.0, connect=20.0)
MAX_RETRIES = 5


def _request_with_retry(client: httpx.Client, method: str, url: str, **kwargs) -> httpx.Response:
    for attempt in range(1 + MAX_RETRIES):
        try:
            response = client.request(method, url, **kwargs)
        except (httpx.TimeoutException, httpx.ReadTimeout) as exc:
            if attempt < MAX_RETRIES:
                wait = 2 ** (attempt + 1)
                time.sleep(wait)
                continue
            raise
        if response.status_code in (403, 429) or (500 <= response.status_code < 600):
            if attempt < MAX_RETRIES:
                wait = 2 ** (attempt + 1)
                time.sleep(wait)
                continue
        response.raise_for_status()
        return response
    return response

BASE_URL = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Procesos/Consulta"
BASE_ROOT = BASE_URL.replace("/Procesos/Consulta", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://consultaprocesos.ramajudicial.gov.co/procesos/bienvenida",
}


def _cliente():
    return httpx.Client(timeout=TIMEOUT, headers=HEADERS, verify=RAMA_VERIFY_SSL)


def buscar_por_nombre(
    nombre: str,
    tipo_persona: str = "nat",
    solo_activos: bool = False,
    pagina: int = 1,
    despacho: Optional[str] = None,
) -> ResultadoBusqueda:
    params = {
        "nombre": nombre,
        "tipoPersona": tipo_persona,
        "soloActivos": str(solo_activos).lower(),
        "codificacionDespacho": despacho or "",
        "pagina": pagina,
    }

    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_URL}/NombreRazonSocial", params=params)
        logger.debug("buscar_por_nombre status=%s", response.status_code)
        data = response.json()

    procesos = [parsear_proceso(p) for p in data.get("procesos", [])]
    pag = data.get("paginacion", {})

    return ResultadoBusqueda(
        procesos=procesos,
        paginacion=Paginacion(
            cantidad_registros=pag.get("cantidadRegistros", 0),
            registros_pagina=pag.get("registrosPagina", 20),
            cantidad_paginas=pag.get("cantidadPaginas", 0),
            pagina=pag.get("pagina", 1),
        ),
    )


def buscar_detalle_proceso(id_proceso: int) -> DetalleProceso:
    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_ROOT}/Proceso/Detalle/{id_proceso}")
        data = response.json()
    return parsear_detalle(data)


def buscar_actuaciones(id_proceso: int, pagina: int = 1, max_paginas: int = 10) -> ResultadoActuaciones:
    todas: list[Actuacion] = []
    paginacion_final = None
    pagina_actual = pagina

    with _cliente() as client:
        while pagina_actual <= max_paginas:
            response = _request_with_retry(
                client, "GET", f"{BASE_ROOT}/Proceso/Actuaciones/{id_proceso}",
                params={"pagina": pagina_actual}
            )
            data = response.json()

            actuaciones = [parsear_actuacion(a) for a in data.get("actuaciones", [])]
            if not actuaciones:
                break
            todas.extend(actuaciones)

            pag = data.get("paginacion", {})
            paginacion_final = Paginacion(
                cantidad_registros=pag.get("cantidadRegistros", 0),
                registros_pagina=pag.get("registrosPagina", 40),
                cantidad_paginas=pag.get("cantidadPaginas", 0),
                pagina=pag.get("pagina", 1),
            )

            total_paginas = pag.get("cantidadPaginas", 0)
            if pagina_actual >= total_paginas:
                break
            pagina_actual += 1
            time.sleep(0.5)

    return ResultadoActuaciones(
        actuaciones=todas,
        paginacion=paginacion_final or Paginacion(
            cantidad_registros=0, registros_pagina=40, cantidad_paginas=0, pagina=1
        ),
    )


def buscar_documentos_actuacion(id_reg_actuacion: int) -> list[DocumentoActuacion]:
    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_ROOT}/Proceso/DocumentosActuacion/{id_reg_actuacion}")
        data = response.json()

    return [parsear_documento(d) for d in data]


def descargar_documento(id_reg_documento: int) -> tuple[bytes, str]:
    """Descarga el archivo PDF de un documento. Retorna (contenido, nombre_archivo)."""
    with _cliente() as client:
        response = _request_with_retry(
            client, "GET", f"{BASE_ROOT}/Descarga/Documento/{id_reg_documento}"
        )
        filename = "documento.pdf"
        cd = response.headers.get("content-disposition", "")
        if "filename=" in cd:
            filename = cd.split("filename=")[-1].strip('" ')
    return response.content, filename


def rama_health_check() -> bool:
    """Verifica rapidamente que Rama Judicial responde. Retorna True si esta operativo."""
    # Intentar con endpoint principal primero
    for intento, (url, params, timeout) in enumerate([
        (f"{BASE_URL}/NumeroRadicacion", {"numero": "05001310301720240048000", "soloActivos": "false", "pagina": 1}, httpx.Timeout(15.0, connect=10.0)),
        (f"{BASE_ROOT}/Proceso/Actuaciones/1", {}, httpx.Timeout(10.0, connect=8.0)),
    ]):
        try:
            with _cliente() as client:
                response = client.get(url, params=params, timeout=timeout)
                if response.status_code < 500:
                    return True
                logger.debug("rama_health_check intento %d: status=%d", intento + 1, response.status_code)
        except Exception as exc:
            logger.debug("rama_health_check intento %d fallo: %s", intento + 1, exc)
    logger.warning("Rama Judicial no responde en ningun endpoint")
    return False


def buscar_por_radicado(numero: str, solo_activos: bool = False, pagina: int = 1) -> ResultadoBusqueda:
    params = {
        "numero": numero,
        "soloActivos": str(solo_activos).lower(),
        "pagina": pagina,
    }

    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_URL}/NumeroRadicacion", params=params)
        logger.debug("buscar_por_radicado status=%s", response.status_code)
        data = response.json()

    procesos = [parsear_proceso(p) for p in data.get("procesos", [])]
    pag = data.get("paginacion", {})

    return ResultadoBusqueda(
        procesos=procesos,
        paginacion=Paginacion(
            cantidad_registros=pag.get("cantidadRegistros", 0),
            registros_pagina=pag.get("registrosPagina", 20),
            cantidad_paginas=pag.get("cantidadPaginas", 0),
            pagina=pag.get("pagina", 1),
        ),
    )

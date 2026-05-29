import httpx
from typing import Optional
from dataclasses import dataclass

BASE_URL = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Procesos/Consulta"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://consultaprocesos.ramajudicial.gov.co/procesos/bienvenida",
}

@dataclass
class Paginacion:
    cantidad_registros: int
    registros_pagina: int
    cantidad_paginas: int
    pagina: int

@dataclass
class Proceso:
    numero_radicacion: str
    despacho: str
    departamento: str
    sujetos_procesales: str
    tipo_proceso: str
    clase_proceso: str
    fecha_ultima_actuacion: Optional[str]

@dataclass
class ResultadoBusqueda:
    procesos: list[Proceso]
    paginacion: Paginacion

def _parsear_proceso(raw: dict) -> Proceso:
    return Proceso(
        numero_radicacion=raw.get("llaveProceso", ""),
        despacho=raw.get("despacho", "").strip(),
        departamento=raw.get("departamento", ""),
        sujetos_procesales=raw.get("sujetosProcesales", ""),
        tipo_proceso=raw.get("tipoProceso", ""),
        clase_proceso=raw.get("claseProceso", ""),
        fecha_ultima_actuacion=raw.get("fechaUltimaActuacion"),
    )

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

    with httpx.Client(timeout=30, headers=HEADERS) as client:
        response = client.get(
            f"{BASE_URL}/NombreRazonSocial",
            params=params,
        )
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text[:500]}")
        response.raise_for_status()
        data = response.json()

    procesos = [_parsear_proceso(p) for p in data.get("procesos", [])]
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
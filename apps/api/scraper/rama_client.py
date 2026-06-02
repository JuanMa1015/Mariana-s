from __future__ import annotations

import httpx
import time
import warnings
from typing import Optional
from dataclasses import dataclass, field

warnings.filterwarnings("ignore", message=".*verify.*", category=UserWarning)

TIMEOUT = 30
MAX_RETRIES = 2


def _request_with_retry(client: httpx.Client, method: str, url: str, **kwargs) -> httpx.Response:
    for attempt in range(1 + MAX_RETRIES):
        response = client.request(method, url, **kwargs)
        if response.status_code == 403 and attempt < MAX_RETRIES:
            wait = 2 ** (attempt + 1)
            time.sleep(wait)
            continue
        response.raise_for_status()
        return response
    return response  # Never reached

BASE_URL = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Procesos/Consulta"
BASE_ROOT = BASE_URL.replace("/Procesos/Consulta", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://consultaprocesos.ramajudicial.gov.co/procesos/bienvenida",
}


def _cliente():
    return httpx.Client(timeout=TIMEOUT, headers=HEADERS, verify=False)

@dataclass
class Paginacion:
    cantidad_registros: int
    registros_pagina: int
    cantidad_paginas: int
    pagina: int

@dataclass
class Proceso:
    id_proceso: int
    numero_radicacion: str
    despacho: str
    departamento: str
    sujetos_procesales: str
    tipo_proceso: str
    clase_proceso: str
    es_privado: Optional[bool]
    fecha_proceso: Optional[str]
    fecha_ultima_actuacion: Optional[str]

@dataclass
class ResultadoBusqueda:
    procesos: list[Proceso]
    paginacion: Paginacion


@dataclass
class ResultadoActuaciones:
    actuaciones: list[Actuacion]
    paginacion: Paginacion


@dataclass
class DetalleProceso:
    id_reg_proceso: int
    llave_proceso: str
    id_conexion: int
    es_privado: bool
    fecha_proceso: Optional[str]
    cod_despacho_completo: Optional[str]
    despacho: str
    ponente: Optional[str]
    tipo_proceso: Optional[str]
    clase_proceso: Optional[str]
    subclase_proceso: Optional[str]
    recurso: Optional[str]
    ubicacion: Optional[str]
    contenido_radicacion: Optional[str]
    fecha_consulta: Optional[str]
    ultima_actualizacion: Optional[str]


@dataclass
class DocumentoActuacion:
    id_reg_documento: int
    id_conexion: int | None
    cons_actuacion: int | None
    guid_documento_sxxiw: str
    nombre: str
    descripcion: str | None
    tipo: str | None
    fecha_carga: Optional[str]


@dataclass
class Actuacion:
    id_reg_actuacion: int
    llave_proceso: str
    cons_actuacion: int
    fecha_actuacion: Optional[str]
    actuacion: str
    anotacion: str | None
    fecha_inicial: Optional[str]
    fecha_final: Optional[str]
    fecha_registro: Optional[str]
    cod_regla: str | None
    con_documentos: bool
    cant: int | None
    documentos: list[DocumentoActuacion] = field(default_factory=list)

def _parsear_proceso(raw: dict) -> Proceso:
    es_privado = raw.get("esPrivado")
    if isinstance(es_privado, str):
        es_privado = es_privado.strip().lower() in {"true", "1", "si", "sí"}

    return Proceso(
        id_proceso=int(raw.get("idProceso") or 0),
        numero_radicacion=raw.get("llaveProceso", ""),
        despacho=raw.get("despacho", "").strip(),
        departamento=raw.get("departamento", ""),
        sujetos_procesales=raw.get("sujetosProcesales", ""),
        tipo_proceso=raw.get("tipoProceso", ""),
        clase_proceso=raw.get("claseProceso", ""),
        es_privado=es_privado,
        fecha_proceso=raw.get("fechaProceso"),
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

    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_URL}/NombreRazonSocial", params=params)
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text[:500]}")
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


def _parsear_detalle(raw: dict) -> DetalleProceso:
    return DetalleProceso(
        id_reg_proceso=int(raw.get("idRegProceso") or 0),
        llave_proceso=raw.get("llaveProceso", ""),
        id_conexion=int(raw.get("idConexion") or 0),
        es_privado=bool(raw.get("esPrivado")),
        fecha_proceso=raw.get("fechaProceso"),
        cod_despacho_completo=raw.get("codDespachoCompleto"),
        despacho=raw.get("despacho", "").strip(),
        ponente=raw.get("ponente"),
        tipo_proceso=raw.get("tipoProceso"),
        clase_proceso=raw.get("claseProceso"),
        subclase_proceso=raw.get("subclaseProceso"),
        recurso=raw.get("recurso"),
        ubicacion=raw.get("ubicacion"),
        contenido_radicacion=raw.get("contenidoRadicacion"),
        fecha_consulta=raw.get("fechaConsulta"),
        ultima_actualizacion=raw.get("ultimaActualizacion"),
    )


def _parsear_documento(raw: dict) -> DocumentoActuacion:
    return DocumentoActuacion(
        id_reg_documento=int(raw.get("idRegDocumento") or 0),
        id_conexion=raw.get("idConexion"),
        cons_actuacion=raw.get("consActuacion"),
        guid_documento_sxxiw=raw.get("guidDocumento_SXXIW", ""),
        nombre=raw.get("nombre", ""),
        descripcion=raw.get("descripcion"),
        tipo=raw.get("tipo"),
        fecha_carga=raw.get("fechaCarga"),
    )


def _parsear_actuacion(raw: dict) -> Actuacion:
    return Actuacion(
        id_reg_actuacion=int(raw.get("idRegActuacion") or 0),
        llave_proceso=raw.get("llaveProceso", ""),
        cons_actuacion=int(raw.get("consActuacion") or 0),
        fecha_actuacion=raw.get("fechaActuacion"),
        actuacion=raw.get("actuacion", ""),
        anotacion=raw.get("anotacion"),
        fecha_inicial=raw.get("fechaInicial"),
        fecha_final=raw.get("fechaFinal"),
        fecha_registro=raw.get("fechaRegistro"),
        cod_regla=raw.get("codRegla"),
        con_documentos=bool(raw.get("conDocumentos")),
        cant=raw.get("cant"),
    )


def buscar_detalle_proceso(id_proceso: int) -> DetalleProceso:
    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_ROOT}/Proceso/Detalle/{id_proceso}")
        data = response.json()
    return _parsear_detalle(data)


def buscar_actuaciones(id_proceso: int, pagina: int = 1) -> ResultadoActuaciones:
    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_ROOT}/Proceso/Actuaciones/{id_proceso}", params={"pagina": pagina})
        data = response.json()

    actuaciones = [_parsear_actuacion(a) for a in data.get("actuaciones", [])]
    pag = data.get("paginacion", {})
    return ResultadoActuaciones(
        actuaciones=actuaciones,
        paginacion=Paginacion(
            cantidad_registros=pag.get("cantidadRegistros", 0),
            registros_pagina=pag.get("registrosPagina", 40),
            cantidad_paginas=pag.get("cantidadPaginas", 0),
            pagina=pag.get("pagina", 1),
        ),
    )


def buscar_documentos_actuacion(id_reg_actuacion: int) -> list[DocumentoActuacion]:
    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_ROOT}/Proceso/DocumentosActuacion/{id_reg_actuacion}")
        data = response.json()

    return [_parsear_documento(d) for d in data]


def buscar_por_radicado(numero: str, solo_activos: bool = False, pagina: int = 1) -> ResultadoBusqueda:
    params = {
        "numero": numero,
        "soloActivos": str(solo_activos).lower(),
        "pagina": pagina,
    }

    with _cliente() as client:
        response = _request_with_retry(client, "GET", f"{BASE_URL}/NumeroRadicacion", params=params)
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text[:500]}")
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
from __future__ import annotations

from typing import Optional
from dataclasses import dataclass, field


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


def parsear_proceso(raw: dict) -> Proceso:
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


def parsear_detalle(raw: dict) -> DetalleProceso:
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


def parsear_documento(raw: dict) -> DocumentoActuacion:
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


def parsear_actuacion(raw: dict) -> Actuacion:
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

export interface Proceso {
  llave_proceso: string
  despacho: string
  departamento: string
  sujetos_procesales: string
  tipo_proceso: string
  clase_proceso?: string | null
  es_privado?: boolean | null
  categoria?: string | null
  fecha_proceso?: string | null
  fecha_ultima_actuacion: string | null
  notificado: boolean
  creado_en: string
  actualizado_en?: string | null
}

export interface DocumentoActuacion {
  id_reg_documento: number
  guid_documento_sxxiw: string
  nombre: string
  descripcion?: string | null
  tipo?: string | null
  fecha_carga?: string | null
}

export interface Actuacion {
  id_reg_actuacion: number
  cons_actuacion: number
  fecha_actuacion?: string | null
  actuacion: string
  anotacion?: string | null
  fecha_inicial?: string | null
  fecha_final?: string | null
  fecha_registro?: string | null
  cod_regla?: string | null
  con_documentos: boolean
  cant?: number | null
  documentos?: DocumentoActuacion[]
}

export interface ListaProcesos {
  total: number
  skip?: number
  limit?: number
  total_paginas?: number
  procesos: Proceso[]
}

export interface Novedad {
  llave_proceso: string
  despacho: string
  departamento: string
  sujetos_procesales: string
  fecha_ultima_actuacion: string | null
}

export interface ListaNovedades {
  total: number
  novedades: Novedad[]
}

export interface ResultadoSync {
  total_consultados: number
  nuevos: number
  actualizados: number
}

export interface DetalleProceso extends Proceso {
  actuaciones?: Actuacion[]
}

export interface ResumenProceso {
  llave_proceso: string
  despacho: string
  departamento: string
}

export interface ActuacionConProceso extends Actuacion {
  proceso: ResumenProceso
}

export interface ActuacionesRecientes {
  total: number
  actuaciones: ActuacionConProceso[]
}
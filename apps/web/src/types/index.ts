export interface Proceso {
  llave_proceso: string
  despacho: string
  departamento: string
  sujetos_procesales: string
  tipo_proceso: string
  clase_proceso?: string | null
  es_privado?: boolean | null
  fecha_proceso?: string | null
  fecha_ultima_actuacion: string | null
  notificado: boolean
  creado_en: string
  actualizado_en?: string | null
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

export interface DetalleProceso extends Proceso {}
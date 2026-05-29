export interface Proceso {
  llave_proceso: string
  despacho: string
  departamento: string
  sujetos_procesales: string
  tipo_proceso: string
  fecha_ultima_actuacion: string | null
  notificado: boolean
  creado_en: string
}

export interface ListaProcesos {
  total: number
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
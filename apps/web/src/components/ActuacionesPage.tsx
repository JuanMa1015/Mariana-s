import { useState, useEffect } from "react"
import { getActuacionesRecientes } from "../api"
import type { ActuacionesRecientes, ActuacionConProceso } from "../types"
import { useNavigate, useSearchParams } from "react-router-dom"

function DocumentosList({ documentos }: { documentos: ActuacionConProceso["documentos"] }) {
  const [open, setOpen] = useState(false)
  if (!documentos?.length) return null
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {documentos.length} documento{documentos.length > 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border-l-2 border-sky-200 pl-3">
          {documentos.map((doc) => (
            <div key={doc.id_reg_documento} className="rounded-xl bg-sky-50/60 px-3 py-2 text-xs text-slate-700">
              <p className="font-medium text-sky-800">{doc.nombre}</p>
              {doc.descripcion && <p className="mt-0.5 text-slate-500">{doc.descripcion}</p>}
              {doc.fecha_carga && <p className="mt-0.5 text-[10px] text-slate-400">Cargado: {doc.fecha_carga}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActuacionCard({ item }: { item: ActuacionConProceso }) {
  const navigate = useNavigate()
  const esHoy = item.fecha_registro?.startsWith(new Date().toISOString().slice(0, 10))

  return (
    <div className="group rounded-2xl border border-violet-100 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <button
          onClick={() => navigate(`/?view=detalle&radicado=${item.proceso.llave_proceso}`)}
          className="rounded-lg bg-violet-50 px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-violet-800 transition hover:bg-violet-100"
        >
          {item.proceso.llave_proceso}
        </button>
        <div className="flex items-center gap-2">
          {esHoy && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Hoy
            </span>
          )}
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {item.fecha_actuacion || "Sin fecha"}
          </span>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-violet-400">
        {item.proceso.despacho}
      </p>

      <p className="text-sm font-semibold text-slate-800">{item.actuacion}</p>

      {item.anotacion && (
        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {item.anotacion}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        {item.fecha_registro && <span>Registro: {item.fecha_registro}</span>}
        {item.fecha_inicial && <span>Inicial: {item.fecha_inicial}</span>}
        {item.fecha_final && <span>Final: {item.fecha_final}</span>}
      </div>

      <DocumentosList documentos={item.documentos} />
    </div>
  )
}

export default function ActuacionesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<ActuacionesRecientes | null>(null)
  const [loading, setLoading] = useState(true)

  const page = Number(searchParams.get("page") || "1")
  const limit = 20

  useEffect(() => {
    setLoading(true)
    getActuacionesRecientes(limit, (page - 1) * limit)
      .then(setData)
      .finally(() => setLoading(false))
  }, [page])

  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / limit))

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f3ff] text-slate-900">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-400">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Actuaciones</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 sm:px-4 sm:py-2 sm:text-sm"
            >
              <span>← Volver</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-5 sm:px-5">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <svg className="h-8 w-8 animate-spin text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm font-medium">Cargando actuaciones...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-600">
                {data?.total ?? 0} actuac{data?.total === 1 ? "ión" : "iones"} en total
              </p>
            </div>

            {data?.actuaciones && data.actuaciones.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.actuaciones.map((item) => (
                  <ActuacionCard key={`${item.id_reg_actuacion}-${item.proceso.llave_proceso}`} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="rounded-3xl border border-violet-200 bg-violet-50 p-8 text-center text-sm text-slate-500">
                  <p className="font-semibold text-violet-700">No hay actuaciones registradas</p>
                  <p className="mt-1">Las actuaciones aparecerán aquí cuando se sincronicen tus procesos.</p>
                </div>
              </div>
            )}

            {totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => { setSearchParams({ page: String(page - 1) }) }}
                  disabled={page <= 1}
                  className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-600 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600">
                  Página {page} de {totalPaginas}
                </span>
                <button
                  onClick={() => { setSearchParams({ page: String(page + 1) }) }}
                  disabled={page >= totalPaginas}
                  className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-600 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

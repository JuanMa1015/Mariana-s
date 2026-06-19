import { useState, useEffect } from "react"
import { getNovedadesDetalle } from "../api"
import type { NovedadesDetalle, Actuacion } from "../types"
import { useNavigate } from "react-router-dom"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return "—"
  return iso.slice(0, 10)
}

function DocumentosPopover({ documentos }: { documentos: Actuacion["documentos"] }) {
  const [open, setOpen] = useState(false)
  if (!documentos?.length) return <span className="text-slate-300">—</span>

  const descargarDocumento = (id: number, nombre: string) => async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${BASE_URL}/procesos/documento/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error("Error al descargar")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = nombre
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.alert("No se pudo descargar el documento")
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {documentos.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-xl border border-sky-100 bg-white p-3 shadow-lg">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-sky-600">Documentos</p>
            <div className="space-y-2">
              {documentos.map((doc) => (
                <div key={doc.id_reg_documento} className="rounded-lg bg-sky-50 p-2 text-[11px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sky-800 truncate">{doc.nombre}</p>
                      {doc.descripcion && <p className="mt-0.5 text-slate-500">{doc.descripcion}</p>}
                      {doc.fecha_carga && <p className="mt-0.5 text-[10px] text-slate-400">{formatearFecha(doc.fecha_carga)}</p>}
                    </div>
                    <button
                      onClick={descargarDocumento(doc.id_reg_documento, doc.nombre)}
                      className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-sky-600 shadow-sm ring-1 ring-sky-200 transition hover:bg-sky-50"
                    >
                      Descargar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ActuacionesTable({ actuaciones }: { actuaciones: Actuacion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-violet-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <th className="px-3 py-2">Fecha actuación</th>
            <th className="px-3 py-2">Actuación</th>
            <th className="px-3 py-2">Anotación</th>
            <th className="px-3 py-2">Fecha inicial</th>
            <th className="px-3 py-2">Fecha final</th>
            <th className="px-3 py-2">Fecha registro</th>
            <th className="px-3 py-2 text-center">Docs</th>
          </tr>
        </thead>
        <tbody>
          {actuaciones.map((a, i) => (
            <tr
              key={a.id_reg_actuacion}
              className={`border-b border-violet-50 transition hover:bg-violet-50/50 ${i === 0 ? "bg-amber-50/40" : ""}`}
            >
              <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">
                {i === 0 && (
                  <span className="mr-1.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">Última</span>
                )}
                {formatearFecha(a.fecha_actuacion)}
              </td>
              <td className="px-3 py-2.5 font-medium text-slate-800">{a.actuacion}</td>
              <td className="max-w-xs px-3 py-2.5 text-slate-600">
                {a.anotacion ? (
                  <span className="line-clamp-3" title={a.anotacion}>{a.anotacion}</span>
                ) : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formatearFecha(a.fecha_inicial)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formatearFecha(a.fecha_final)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formatearFecha(a.fecha_registro)}</td>
              <td className="px-3 py-2.5 text-center">
                <DocumentosPopover documentos={a.documentos} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function NovedadesPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<NovedadesDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [skip, setSkip] = useState(0)

  const limit = 25

  useEffect(() => {
    setLoading(true)
    getNovedadesDetalle(skip, limit)
      .then(setData)
      .finally(() => setLoading(false))
  }, [skip])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1
  const currentPage = Math.floor(skip / limit) + 1

  const toggleExpand = (llave: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(llave)) next.delete(llave)
      else next.add(llave)
      return next
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f3ff] text-slate-900">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-400">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Novedades</h1>
          </div>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 sm:px-4 sm:py-2 sm:text-sm"
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 sm:px-5">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <svg className="h-8 w-8 animate-spin text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm font-medium">Cargando novedades...</p>
            </div>
          </div>
        ) : !data?.novedades?.length ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center text-sm">
              <p className="font-semibold text-emerald-700">¡Todo al día!</p>
              <p className="mt-1 text-emerald-600">No hay novedades pendientes de revisar.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-600">
                {data.total} proceso{data.total > 1 ? "s" : ""} con novedades
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSkip((s) => Math.max(0, s - limit))}
                  disabled={skip === 0}
                  className="rounded-lg border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500">
                  Pág. {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setSkip((s) => s + limit)}
                  disabled={!data || skip + limit >= data.total}
                  className="rounded-lg border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {data.novedades.map((nov) => {
                const isOpen = expanded.has(nov.llave_proceso)
                return (
                  <div
                    key={nov.llave_proceso}
                    className={`rounded-2xl border transition ${
                      isOpen ? "border-violet-300 bg-white shadow-md" : "border-violet-100 bg-white shadow-sm hover:border-violet-200"
                    }`}
                  >
                    <button
                      onClick={() => toggleExpand(nov.llave_proceso)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
                    >
                      <svg
                        className={`h-4 w-4 shrink-0 text-violet-400 transition ${isOpen ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>

                      <span className="min-w-[13ch] font-mono text-xs font-bold tracking-widest text-violet-800">
                        {nov.llave_proceso}
                      </span>

                      {nov.tipo_novedad && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          nov.tipo_novedad === "nuevo" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {nov.tipo_novedad === "nuevo" ? "Nuevo" : "Actualización"}
                        </span>
                      )}

                      {nov.categoria && (
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          nov.categoria === "Trabajo" ? "bg-sky-100 text-sky-700" : nov.categoria === "Consultorio" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"
                        }`}>
                          {nov.categoria}
                        </span>
                      )}

                      <span className="hidden min-w-0 flex-1 truncate text-xs text-slate-500 sm:block">
                        {nov.despacho}
                      </span>

                      <span className="ml-auto shrink-0 text-[11px] font-medium text-amber-600">
                        {formatearFecha(nov.fecha_ultima_actuacion)}
                      </span>

                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {nov.actuaciones.length}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-violet-100 px-4 pb-3 pt-3 sm:px-5">
                        <ActuacionesTable actuaciones={nov.actuaciones} />
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => navigate(`/?view=detalle&radicado=${nov.llave_proceso}`)}
                            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
                          >
                            Ver detalle completo →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

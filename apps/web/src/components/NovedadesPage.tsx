import { useState, useEffect } from "react"
import { getNovedadesDetalle, marcarTodoLeido } from "../api"
import { formatearFechaCorta } from "../utils/fechas"
import { formatearRadicado } from "../utils/radicado"
import toast from "react-hot-toast"
import type { NovedadesDetalle, NovedadDetalle, Actuacion } from "../types"
import { useNavigate } from "react-router-dom"
import BotonDocumento from "./BotonDocumento"
import Modal from "./Modal"
import { removeCache } from "../api/cache"
import { useTitle } from "../hooks/useTitle"

function DocumentosPopover({ documentos }: { documentos: Actuacion["documentos"] }) {
  const [open, setOpen] = useState(false)
  if (!documentos?.length) return <span className="text-slate-400">—</span>

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`${documentos.length} documento${documentos.length !== 1 ? "s" : ""}`}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {documentos.length}
      </button>
      {open && (
        <Modal titulo="Documentos de la actuación" onClose={() => setOpen(false)}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-600">Documentos</p>
            <div className="space-y-2">
              {documentos.map((doc) => (
                <div key={doc.id_reg_documento} className="rounded-lg bg-sky-50 p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sky-800 truncate">{doc.nombre}</p>
                      {doc.descripcion && <p className="mt-0.5 text-slate-500">{doc.descripcion}</p>}
                      {doc.fecha_carga && <p className="mt-0.5 text-[10px] text-slate-400">{formatearFechaCorta(doc.fecha_carga) ?? "—"}</p>}
                    </div>
                    <BotonDocumento id={doc.id_reg_documento} nombre={doc.nombre} />
                  </div>
                </div>
              ))}
            </div>
        </Modal>
      )}
    </div>
  )
}

function ActuacionesTable({ actuaciones }: { actuaciones: Actuacion[] }) {
  const [visibles, setVisibles] = useState(5)
  return (
    <div className="overflow-x-auto">
      <table className="block w-full border-collapse text-sm sm:table sm:text-xs">
        <thead className="hidden sm:table-header-group">
          <tr className="border-b border-indigo-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2">Fecha actuación</th>
            <th className="px-3 py-2">Actuación</th>
            <th className="px-3 py-2">Anotación</th>
            <th className="px-3 py-2">Fecha inicial</th>
            <th className="px-3 py-2">Fecha final</th>
            <th className="px-3 py-2">Fecha registro</th>
            <th className="px-3 py-2 text-center">Docs</th>
          </tr>
        </thead>
        <tbody className="block sm:table-row-group">
          {actuaciones.slice(0, visibles).map((a, i) => (
            <tr
              key={a.id_reg_actuacion}
              className={`grid grid-cols-2 border-b border-indigo-50 py-3 transition sm:table-row sm:py-0 hover:bg-indigo-50/50 ${i === 0 ? "bg-amber-50/40" : ""}`}
            >
              <td className="col-span-2 block px-3 py-2.5 font-medium text-slate-700 sm:table-cell">
                {i === 0 && (
                  <span className="mr-1.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">Última</span>
                )}
                {formatearFechaCorta(a.fecha_actuacion) ?? "—"}
              </td>
              <td className="col-span-2 block px-3 py-2.5 font-semibold text-slate-800 sm:table-cell">{a.actuacion}</td>
              <td className="col-span-2 block px-3 py-2.5 text-slate-600 sm:table-cell sm:max-w-xs">
                {a.anotacion ? (
                  <span className="whitespace-pre-line break-words" title={a.anotacion}>{a.anotacion}</span>
                ) : "—"}
              </td>
              <td className="block px-3 py-2.5 text-slate-600 sm:table-cell"><span className="block text-xs font-semibold sm:hidden">Inicio</span>{formatearFechaCorta(a.fecha_inicial) ?? "—"}</td>
              <td className="block px-3 py-2.5 text-slate-600 sm:table-cell"><span className="block text-xs font-semibold sm:hidden">Fin</span>{formatearFechaCorta(a.fecha_final) ?? "—"}</td>
              <td className="block px-3 py-2.5 text-slate-600 sm:table-cell"><span className="block text-xs font-semibold sm:hidden">Registro</span>{formatearFechaCorta(a.fecha_registro) ?? "—"}</td>
              <td className="block px-3 py-2.5 sm:table-cell sm:text-center">
                <DocumentosPopover documentos={a.documentos} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {actuaciones.length > 5 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 pt-4">
          <p role="status" className="text-xs text-slate-600">Mostrando {Math.min(visibles, actuaciones.length)} de {actuaciones.length} actuaciones</p>
          {visibles < actuaciones.length && (
            <button type="button" onClick={() => setVisibles((cantidad) => cantidad + 5)}
              className="min-h-11 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700">
              Ver más actuaciones
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function InsigniaAviso({ novedad, intentosMax = 5 }: { novedad: NovedadDetalle; intentosMax?: number }) {
  const base = "text-xs font-medium"

  if (novedad.notificacion_pendiente) {
    const intentos = novedad.intentos_notificacion ?? 0
    if (intentos >= intentosMax) {
      return (
        <span className={`${base} text-rose-700`} title="Agotamos los reintentos del aviso; la novedad sigue visible aquí">
          No se pudo avisar
        </span>
      )
    }
    return (
      <span className={`${base} text-amber-800`} title="Estamos intentando enviar el aviso a tus canales">
        Sin avisar<span className="hidden sm:inline">{intentos > 0 ? ` · reintento ${intentos}` : ""}</span>
      </span>
    )
  }

  switch (novedad.canales_notificados) {
    case "email+telegram":
      return (
        <span className={`${base} text-slate-600`} title="El aviso llegó por correo y por Telegram">
          Avisado<span className="hidden sm:inline">: Correo y Telegram</span>
        </span>
      )
    case "email":
      return (
        <span className={`${base} text-slate-600`} title="El aviso llegó por correo">
          Correo<span className="hidden sm:inline"> avisado</span>
        </span>
      )
    case "telegram":
      return (
        <span className={`${base} text-slate-600`} title="El aviso llegó por Telegram">
          Telegram<span className="hidden sm:inline"> avisado</span>
        </span>
      )
    default: {
      // Combinaciones con la app ("email+push", "email+telegram+push"…): se arma la lista de canales
      if (novedad.canales_notificados?.includes("push")) {
        const nombres = { email: "Correo", telegram: "Telegram", push: "App" } as Record<string, string>
        const lista = novedad.canales_notificados.split("+").map((c) => nombres[c] ?? c)
        return (
          <span className={`${base} text-slate-600`} title={`El aviso llegó por ${lista.join(", ")}`}>
            Avisado<span className="hidden sm:inline">: {lista.join(", ")}</span>
          </span>
        )
      }
      // Novedades anteriores al registro de canales: sin dato confiable,
      // mejor no mostrar nada que mostrar algo equivocado.
      return null
    }
  }
}

export default function NovedadesPage() {
  useTitle("Novedades")
  const navigate = useNavigate()
  const [data, setData] = useState<NovedadesDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [marcando, setMarcando] = useState(false)
  const [confirmarTodo, setConfirmarTodo] = useState(false)
  const [skip, setSkip] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  const limit = 25

  useEffect(() => {
    let active = true
    getNovedadesDetalle(skip, limit)
      .then((d) => {
        if (!active) return
        if (d.total > 0 && skip >= d.total) {
          setSkip(Math.max(0, Math.floor((d.total - 1) / limit) * limit))
          return
        }
        setError(false)
        setData(d)
      })
      .catch(() => {
        if (!active) return
        setError(true)
        toast.error("No se pudieron cargar las novedades")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [skip, reloadKey])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1
  const currentPage = Math.floor(skip / limit) + 1

  const handleMarcarTodo = async () => {
    if (marcando) return
    setMarcando(true)
    try {
      const res = await marcarTodoLeido()
      removeCache("novedades")
      toast.success(`${res.marcados} procesos marcados como leídos`)
      setConfirmarTodo(false)
      setExpanded(new Set())
      setLoading(true)
      setSkip(0)
      setReloadKey((k) => k + 1)
    } catch {
      toast.error("No se pudieron marcar los procesos. Vuelve a intentar.")
    } finally {
      setMarcando(false)
    }
  }

  const toggleExpand = (llave: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(llave)) next.delete(llave)
      else next.add(llave)
      return next
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-indigo-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-400">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Novedades</h1>
          </div>
          <button
            onClick={() => navigate("/procesos")}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 sm:px-4 sm:py-2 sm:text-sm"
          >
            ← Volver
          </button>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 sm:px-5">
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
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm">
              <p className="font-semibold text-rose-700">No se pudieron cargar las novedades</p>
              <p className="mt-1 text-rose-600">Revisa tu conexión e intenta de nuevo.</p>
              <button
                onClick={() => { setLoading(true); setReloadKey((k) => k + 1) }}
                className="mt-4 rounded-full border border-rose-200 bg-white px-4 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : !data?.novedades?.length ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-sm">
              <p className="font-semibold text-emerald-700">¡Todo al día!</p>
              <p className="mt-1 text-emerald-600">No hay novedades pendientes de revisar en la última consulta. La verificación de cada expediente puede tener una fecha diferente.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-600">
                {data.total} proceso{data.total > 1 ? "s" : ""} con novedades
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmarTodo(true)}
                  disabled={marcando}
                  className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                >
                  {marcando ? "Marcando..." : "Marcar todo como leído"}
                </button>
                {totalPages > 1 && (<>
                <button
                  onClick={() => { setLoading(true); setSkip((s) => Math.max(0, s - limit)) }}
                  disabled={skip === 0}
                  className="rounded-lg border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500">
                  Pág. {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => { setLoading(true); setSkip((s) => s + limit) }}
                  disabled={!data || skip + limit >= data.total}
                  className="rounded-lg border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
                </>)}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {data.novedades.map((nov) => {
                const isOpen = expanded.has(nov.llave_proceso)
                return (
                  <div
                    key={nov.llave_proceso}
                    className={`rounded-2xl border transition ${
                      isOpen ? "border-indigo-300 bg-white shadow-md" : "border-indigo-100 bg-white shadow-sm hover:border-indigo-200"
                    }`}
                  >
                    <button
                      onClick={() => toggleExpand(nov.llave_proceso)}
                      aria-expanded={isOpen}
                      aria-controls={`actuaciones-${nov.llave_proceso}`}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left sm:px-5"
                    >
                      <svg
                        className={`h-4 w-4 shrink-0 text-indigo-400 transition ${isOpen ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>

                      <span className="min-w-[13ch] font-mono text-xs font-bold tracking-widest text-indigo-800">
                        {formatearRadicado(nov.llave_proceso)}
                      </span>
                      {nov.alias && <span className="max-w-[16rem] truncate text-sm font-semibold text-slate-800">{nov.alias}</span>}

                      {nov.actuaciones[0] && (
                        <span className="mt-2 w-full text-base font-semibold leading-snug text-slate-900">{nov.actuaciones[0].actuacion}</span>
                      )}
                      <span className="w-full text-sm text-slate-600">{nov.despacho}</span>
                      <span className="text-sm font-medium text-slate-700">{formatearFechaCorta(nov.fecha_ultima_actuacion) ?? "Sin fecha"}</span>
                      <span className="text-xs text-slate-500">{nov.actuaciones.length} actuaciones</span>
                      <span className="mt-2 flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
                        <span className="text-xs font-semibold text-amber-800">Pendiente de revisión</span>
                        <InsigniaAviso novedad={nov} intentosMax={data.intentos_max_aviso} />
                      </span>
                      {(nov.categoria || nov.tipo_novedad) && (
                        <span className="w-full text-xs text-slate-500">
                          {[nov.categoria, nov.tipo_novedad ? (nov.tipo_novedad === "nuevo" ? "Nuevo" : "Actualización") : null].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </button>

                    {isOpen && (
                      <div id={`actuaciones-${nov.llave_proceso}`} className="border-t border-indigo-100 px-4 pb-3 pt-3 sm:px-5">
                        <ActuacionesTable actuaciones={nov.actuaciones} />
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => navigate(`/procesos/${nov.llave_proceso}`, { state: { from: "/novedades" } })}
                            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
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
      {confirmarTodo && <Modal titulo="¿Marcar todos los procesos como leídos?" role="alertdialog" onClose={() => { if (!marcando) setConfirmarTodo(false) }}>
        <p className="text-sm text-slate-700">Se marcarán {data?.total ?? 0} procesos, incluidos los de otras páginas. La entrega de un aviso y tu revisión del expediente se registran por separado.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button disabled={marcando} onClick={() => { void handleMarcarTodo() }} className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">{marcando ? "Marcando…" : "Sí, marcar todo"}</button>
          <button disabled={marcando} onClick={() => setConfirmarTodo(false)} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Cancelar</button>
        </div>
      </Modal>}
    </div>
  )
}

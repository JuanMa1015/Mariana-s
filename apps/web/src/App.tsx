import { useState, useEffect } from "react"
import { getProceso, getProcesos, getNovedades, postAddRadicado } from "./api"
import type { DetalleProceso, ListaProcesos, ListaNovedades } from "./types"
import TablaProcesos from "./components/TablaProcesos"

export default function App() {
  const [procesos, setProcesos] = useState<ListaProcesos | null>(null)
  const [novedades, setNovedades] = useState<ListaNovedades | null>(null)
  const [newRadicado, setNewRadicado] = useState({ llave_proceso: "" })
  const [detalle, setDetalle] = useState<DetalleProceso | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)

  const searchParams = new URLSearchParams(window.location.search)
  const view = searchParams.get("view")
  const radicadoDetalle = searchParams.get("radicado")

  const esDetalle = view === "detalle" && Boolean(radicadoDetalle)

  const cargarDatos = async () => {
    if (esDetalle && radicadoDetalle) {
      setLoadingDetalle(true)
      try {
        const [p, n, d] = await Promise.all([getProcesos(undefined, undefined, 0, 1), getNovedades(), getProceso(radicadoDetalle)])
        setProcesos(p)
        setNovedades(n)
        setDetalle(d)
      } finally {
        setLoadingDetalle(false)
      }
      return
    }

    const skip = (page - 1) * limit
    const [p, n] = await Promise.all([getProcesos(undefined, undefined, skip, limit), getNovedades()])
    setProcesos(p)
    setNovedades(n)
  }

  useEffect(() => {
    cargarDatos()
  }, [page, limit, esDetalle, radicadoDetalle])

  const abrirDetalle = (llaveProceso: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set("view", "detalle")
    url.searchParams.set("radicado", llaveProceso)
    window.open(url.toString(), "_blank", "noopener,noreferrer")
  }

  const volverLista = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete("view")
    url.searchParams.delete("radicado")
    window.location.href = url.toString()
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Seguimiento por radicado</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-4 sm:py-2 sm:text-sm"
            >
              <span>Consulta oficial</span>
              <span aria-hidden="true">↗</span>
            </a>
            <div className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm sm:px-4 sm:py-2 sm:text-sm">
              Notificación por email
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-none flex-1 min-h-0 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
        {esDetalle ? (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Vista detalle</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">{radicadoDetalle}</h2>
              </div>
              <button
                type="button"
                onClick={volverLista}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Volver a la lista
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
              {loadingDetalle ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Cargando detalle...</div>
              ) : detalle ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">Radicado</p>
                      <p className="mt-1 break-all text-lg font-bold text-slate-950">{detalle.llave_proceso}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Estado</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{detalle.notificado ? "Vigente" : "Pendiente"}</p>
                    </div>
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">Última actuación</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{detalle.fecha_ultima_actuacion || "Sin dato"}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Despacho</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{detalle.despacho || "Sin dato"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Departamento</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{detalle.departamento || "Sin dato"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{detalle.tipo_proceso || "Sin dato"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Clase</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{detalle.clase_proceso || "Sin dato"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Privado</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{detalle.es_privado ? "Sí" : "No"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Creado</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{detalle.creado_en ? new Date(detalle.creado_en).toLocaleString("es-CO") : "Sin dato"}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Sujetos procesales</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{detalle.sujetos_procesales || "Sin dato"}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <a
                      href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <span>Consulta oficial</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(detalle.llave_proceso)
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <span>Copiar radicado</span>
                      <span aria-hidden="true">⧉</span>
                    </button>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Exportes oficiales</p>
                        <p className="mt-1 text-sm text-slate-600">La Rama genera estos archivos después de consultar el radicado.</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                        DOC y CSV
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <span>Ver DOC</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                      <a
                        href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        <span>Ver CSV</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">No se encontró el radicado.</div>
              )}
            </div>
          </section>
        ) : (
          <>
        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">Total procesos guardados</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{procesos?.total ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">Novedades sin revisar</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{novedades?.total ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">Procesos al día</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{Math.max((procesos?.total ?? 0) - (novedades?.total ?? 0), 0)}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              placeholder="Radicado de 23 dígitos"
              value={newRadicado.llave_proceso}
              onChange={(e) => setNewRadicado({ llave_proceso: e.target.value.replace(/\D/g, "") })}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              maxLength={23}
              inputMode="numeric"
            />
            <button
              onClick={async () => {
                if (newRadicado.llave_proceso.length !== 23) {
                  alert("El radicado debe tener 23 dígitos")
                  return
                }
                const res = await postAddRadicado(newRadicado)
                if (res.created) {
                  setNewRadicado({ llave_proceso: "" })
                  await cargarDatos()
                } else {
                  alert(res.detail || res.message || 'No creado')
                }
              }}
              className="rounded-2xl border border-sky-700 bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800"
            >
              Agregar
            </button>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Lista de seguimiento</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">Radicados guardados y novedades</h3>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 sm:text-xs">
              {procesos?.total ?? 0} guardados · {novedades?.total ?? 0} novedades
            </div>
          </div>

          <div className="min-h-0 flex-1 border-t border-slate-100">
            {procesos && <TablaProcesos procesos={procesos.procesos} onOpenDetalle={abrirDetalle} onDelete={async () => await cargarDatos()} />}
          </div>
        </section>
        <div className="flex items-center justify-between px-1 pt-1 text-xs text-slate-600">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700">
            Página {page} de {procesos?.total_paginas ?? 1}
          </div>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page >= (procesos?.total_paginas ?? 1)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
          </>
        )}
      </main>
    </div>
  )
}
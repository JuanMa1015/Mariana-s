import { useState, useEffect } from "react"
import { getProceso, getProcesos, getNovedades, postAddRadicado } from "./api"
import toast from "react-hot-toast"
import type { DetalleProceso, ListaProcesos, ListaNovedades } from "./types"
import TablaProcesos from "./components/TablaProcesos"
import DetalleView from "./components/DetalleView"
import { useNavigate } from "react-router-dom"

export default function App() {
  const navigate = useNavigate()
  const [procesos, setProcesos] = useState<ListaProcesos | null>(null)
  const [novedades, setNovedades] = useState<ListaNovedades | null>(null)
  const [newRadicado, setNewRadicado] = useState({ llave_proceso: "", categoria: "Trabajo" })
  const [detalle, setDetalle] = useState<DetalleProceso | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [busqueda, setBusqueda] = useState("")

  const searchParams = new URLSearchParams(window.location.search)
  const view = searchParams.get("view")
  const radicadoDetalle = searchParams.get("radicado")

  const esDetalle = view === "detalle" && Boolean(radicadoDetalle)

  const cargarLista = async () => {
    const skip = (page - 1) * limit
    const [p, n] = await Promise.all([getProcesos(undefined, undefined, skip, limit, filtroCategoria || undefined, busqueda || undefined), getNovedades()])
    setProcesos(p)
    setNovedades(n)
  }

  useEffect(() => {
    cargarLista()
  }, [page, limit, filtroCategoria, busqueda])

  useEffect(() => {
    if (!esDetalle || !radicadoDetalle) return
    setLoadingDetalle(true)
    setDetalle(null)
    getProceso(radicadoDetalle).then(setDetalle).finally(() => setLoadingDetalle(false))
  }, [esDetalle, radicadoDetalle])

  const abrirDetalle = (llaveProceso: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set("view", "detalle")
    url.searchParams.set("radicado", llaveProceso)
    navigate(`${url.pathname}${url.search}${url.hash}`)
  }

  const volverLista = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete("view")
    url.searchParams.delete("radicado")
    navigate(`${url.pathname}${url.search}${url.hash}`)
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("email")
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f3ff] text-slate-900">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-400">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Seguimiento por radicado</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/novedades")}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 sm:px-4 sm:py-2 sm:text-sm"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="hidden sm:inline">Novedades</span>
            </button>
            <a
              href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 sm:px-4 sm:py-2 sm:text-sm"
            >
              <span className="hidden sm:inline">Consulta oficial</span>
              <span aria-hidden="true">↗</span>
            </a>
            <button
              onClick={handleLogout}
              className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 sm:px-4 sm:py-2 sm:text-sm"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-none flex-1 min-h-0 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
        {esDetalle ? (
          <section className="flex min-h-0 flex-1 flex-col overflow-auto p-0">
            {loadingDetalle ? (
              <div className="flex flex-1 items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <svg className="h-8 w-8 animate-spin text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm font-medium">Cargando proceso...</p>
                </div>
              </div>
            ) : detalle ? (
              <DetalleView detalle={detalle} onVolver={volverLista} onActualizado={cargarLista} />
            ) : (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                No se encontró el radicado solicitado.
              </div>
            )}
          </section>
        ) : (
          <>
        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-violet-200 bg-violet-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-500">Total procesos guardados</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-violet-900">{procesos?.total ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-600">Novedades sin revisar</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-amber-900">{novedades?.total ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-600">Procesos al día</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-emerald-900">{Math.max((procesos?.total ?? 0) - (novedades?.total ?? 0), 0)}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <input
                placeholder="Radicado de 23 dígitos"
                value={newRadicado.llave_proceso}
                onChange={(e) => setNewRadicado({ ...newRadicado, llave_proceso: e.target.value.replace(/\D/g, "") })}
                className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 px-4 py-3 text-sm outline-none transition placeholder:text-violet-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                maxLength={23}
                inputMode="numeric"
              />
              <select
                value={newRadicado.categoria}
                onChange={(e) => setNewRadicado({ ...newRadicado, categoria: e.target.value })}
                className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:w-44"
              >
                <option value="Trabajo">Trabajo</option>
                <option value="Consultorio">Consultorio</option>
              </select>
            </div>
            <button
              onClick={async () => {
                if (newRadicado.llave_proceso.length !== 23) {
                  toast.error("El radicado debe tener 23 dígitos")
                  return
                }
                const loadingToast = toast.loading("Agregando radicado...")
                try {
                  const res = await postAddRadicado(newRadicado)
                  if (res.created) {
                    setNewRadicado({ llave_proceso: "", categoria: "Trabajo" })
                    await cargarLista()
                    toast.success("Radicado agregado exitosamente", { id: loadingToast })
                  } else {
                    toast.error(res.detail || res.message || 'Error al agregar', { id: loadingToast })
                  }
                } catch (err: any) {
                  toast.error(err.message, { id: loadingToast })
                }
              }}
              className="rounded-2xl border border-violet-300 bg-violet-400 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-95"
            >
              Agregar
            </button>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-violet-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-400">Lista de seguimiento</p>
              <h3 className="mt-1 text-base font-semibold text-slate-800 sm:text-lg">Radicados guardados y novedades</h3>
            </div>
            <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-600 sm:text-xs">
              {procesos?.total ?? 0} guardados · {novedades?.total ?? 0} novedades
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-col gap-2 border-b border-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="flex gap-1">
              {["", "Trabajo", "Consultorio"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setFiltroCategoria(cat); setPage(1) }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    filtroCategoria === cat
                      ? "bg-violet-200 text-violet-800"
                      : "bg-violet-50 text-violet-600 hover:bg-violet-100"
                  }`}
                >
                  {cat || "Todas"}
                </button>
              ))}
            </div>
            <input
              placeholder="Buscar radicado..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
              className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 px-4 py-2 text-sm outline-none transition placeholder:text-violet-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:w-64"
            />
          </div>

          <div className="min-h-0 flex-1 border-t border-violet-50">
            {procesos && <TablaProcesos procesos={procesos.procesos} onOpenDetalle={abrirDetalle} onDelete={cargarLista} />}
          </div>
        </section>
        <div className="flex items-center justify-between px-1 pt-1 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-full border border-violet-200 bg-white px-3 py-1.5 font-semibold text-violet-600 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <div className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 font-semibold text-violet-600">
            Página {page} de {procesos?.total_paginas ?? 1}
          </div>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page >= (procesos?.total_paginas ?? 1)}
            className="rounded-full border border-violet-200 bg-white px-3 py-1.5 font-semibold text-violet-600 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
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
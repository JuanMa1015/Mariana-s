import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { getProceso, getProcesos, getNovedades, postAddRadicado, postSync, logoutUser } from "./api"
import { getCache, setCache, removeCache } from "./api/cache"
import toast from "react-hot-toast"
import type { DetalleProceso, ListaProcesos, ListaNovedades, ResultadoSync } from "./types"
import TablaProcesos from "./components/TablaProcesos"
import DetalleView from "./components/DetalleView"
import { useNavigate, useParams } from "react-router-dom"
import { captureException } from "./sentry"

function tiempoRelativo(fecha: string | null | undefined): string {
  if (!fecha) return "Aún sin sincronizar"
  const t = new Date(fecha).getTime()
  if (isNaN(t)) return "Aún sin sincronizar"
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return "hace un momento"
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} hora${horas !== 1 ? "s" : ""}`
  return new Date(t).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
}

export default function App() {
  const navigate = useNavigate()
  const username = localStorage.getItem("username") || localStorage.getItem("email")?.split("@")[0] || "Mariana"

  const saludo = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return "Buenos días"
    if (h < 18) return "Buenas tardes"
    return "Buenas noches"
  }, [])
  const [procesos, setProcesos] = useState<ListaProcesos | null>(null)
  const [loadingLista, setLoadingLista] = useState(false)
  const [novedades, setNovedades] = useState<ListaNovedades | null>(null)
  const [newRadicado, setNewRadicado] = useState({ llave_proceso: "", categoria: "General" })
  const [detalle, setDetalle] = useState<DetalleProceso | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<ResultadoSync | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [apiOffline, setApiOffline] = useState(false)

  const ultimaSync = useMemo(() => {
    let mejor: string | null = null
    let mejorT = -Infinity
    for (const p of procesos?.procesos ?? []) {
      const f = p.ultima_sincronizacion
      if (!f) continue
      const t = new Date(f).getTime()
      if (!isNaN(t) && t > mejorT) {
        mejorT = t
        mejor = f
      }
    }
    return mejor
  }, [procesos])

  useEffect(() => {
    const check = () => {
      fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/health`, { signal: AbortSignal.timeout(5000) })
        .then((r) => setApiOffline(!r.ok))
        .catch(() => setApiOffline(true))
    }
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [])

  const { llaveProceso } = useParams()

  const esDetalle = Boolean(llaveProceso)
  const fetchingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const cacheKey = `lista:${page}:${limit}:${filtroCategoria || ""}:${busqueda || ""}`

  const cargarLista = useCallback(async (forceFresh = false) => {
    if (fetchingRef.current && !forceFresh) return
    fetchingRef.current = true

    if (!forceFresh) {
      const cachedP = getCache<ListaProcesos>(cacheKey)
      const cachedN = getCache<ListaNovedades>("novedades")
      if (cachedP && cachedN) {
        setProcesos(cachedP)
        setNovedades(cachedN)
      }
    }

    if (!forceFresh && getCache<ListaProcesos>(cacheKey)) {
      setLoadingLista(false)
    } else {
      setLoadingLista(true)
    }

    const skip = (page - 1) * limit
    try {
      const [p, n] = await Promise.all([
        getProcesos(undefined, undefined, skip, limit, filtroCategoria || undefined, busqueda || undefined),
        getNovedades(),
      ])
      setProcesos(p)
      setNovedades(n)
      setCache(cacheKey, p)
      setCache("novedades", n)
    } catch {
      /* keep showing cached data on error */
    } finally {
      setLoadingLista(false)
      fetchingRef.current = false
    }
  }, [page, limit, filtroCategoria, busqueda, cacheKey])

  useEffect(() => {
    cargarLista()
  }, [cargarLista])

  useEffect(() => {
    if (!esDetalle || !llaveProceso) return
    setLoadingDetalle(true)
    setDetalle(null)
    getProceso(llaveProceso).then(setDetalle).finally(() => setLoadingDetalle(false))
  }, [esDetalle, llaveProceso])

  const abrirDetalle = (llave: string) => {
    navigate(`/procesos/${llave}`)
  }

  const volverLista = () => {
    navigate("/")
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const enInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      if (enInput) {
        if (e.key === "Escape") (document.activeElement as HTMLElement).blur()
        return
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        navigate("/novedades")
      } else if (e.key === "/") {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === "Escape" && esDetalle) {
        e.preventDefault()
        navigate("/")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate, esDetalle])

  const handleSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setSyncResult(null)
    const loadingToast = toast.loading("Sincronizando con Rama Judicial...")
    try {
      const result = await postSync()
      setSyncResult(result)
      toast.success(
        `Sincronización completa: ${result.nuevos} nuevos, ${result.actualizados} actualizados, ${result.total_consultados} consultados`,
        { id: loadingToast, duration: 5000 },
      )
      removeCache(cacheKey)
      removeCache("novedades")
      await cargarLista(true)
    } catch (err: any) {
      captureException(err)
      toast.error("Error al sincronizar. Intenta de nuevo.", { id: loadingToast })
    } finally {
      setSyncing(false)
    }
  }, [syncing, cacheKey, cargarLista])

  const handleLogout = async () => {
    try { await logoutUser() } catch { /* ignore */ }
    localStorage.clear()
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f3ff] text-slate-900">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">{saludo}, {username}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              aria-label="Sincronizar procesos con Rama Judicial"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
            >
              <svg className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sincronizar"}</span>
            </button>
            <button
              onClick={() => navigate("/novedades")}
              aria-label="Ver novedades"
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
              aria-label="Abrir consulta oficial en Rama Judicial"
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 sm:px-4 sm:py-2 sm:text-sm"
            >
              <span className="hidden sm:inline">Consulta oficial</span>
              <span aria-hidden="true">↗</span>
            </a>
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:px-4 sm:py-2 sm:text-sm"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-none flex-1 min-h-0 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
        {apiOffline && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm no-print">
            <span className="font-semibold">API no disponible:</span> los datos pueden estar desactualizados. Intenta recargar la pagina.
          </div>
        )}
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
              <DetalleView detalle={detalle} onVolver={volverLista} onActualizado={() => { removeCache(cacheKey); removeCache("novedades"); cargarLista(true) }} />
            ) : (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                No se encontró el radicado solicitado.
              </div>
            )}
          </section>
        ) : (
          <>
        {syncResult && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm no-print">
            <span className="font-semibold">Sincronizacion completada:</span>{' '}
            {syncResult.nuevos} nuevo{syncResult.nuevos !== 1 ? "s" : ""},{" "}
            {syncResult.actualizados} actualizado{syncResult.actualizados !== 1 ? "s" : ""},{" "}
            {syncResult.total_consultados} consultado{syncResult.total_consultados !== 1 ? "s" : ""}
            {(syncResult.errores_app ?? 0) > 0 ? (
              <>
                <span className="mx-2 inline-block h-3 w-px bg-emerald-300" />
                <span className="font-semibold text-rose-600">
                  {(syncResult.errores_app ?? 0)} error{(syncResult.errores_app ?? 0) !== 1 ? "es" : ""} interno{(syncResult.errores_app ?? 0) !== 1 ? "s" : ""}
                </span>
              </>
            ) : null}
            {(syncResult.errores_rama ?? 0) > 0 || (syncResult.radicados_saltados_rama?.length ?? 0) > 0 ? (
              <>
                <span className="mx-2 inline-block h-3 w-px bg-emerald-300" />
                <span className="font-medium text-amber-600">
                  {((syncResult.errores_rama ?? 0) + (syncResult.radicados_saltados_rama?.length ?? 0))} por Rama Judicial (la app esta bien)
                </span>
              </>
            ) : null}
          </div>
        )}
        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-violet-200 bg-violet-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">Total procesos guardados</p>
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
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-indigo-600">Última sincronización</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-indigo-900">
              {ultimaSync ? tiempoRelativo(ultimaSync) : "Sin datos"}
            </p>
            <p className="mt-1 text-xs text-indigo-700">
              {ultimaSync ? "Datos actualizados desde Rama Judicial." : "Agrega un radicado y sincroniza."}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <input
                  aria-label="Radicado de 23 dígitos"
                  placeholder="Radicado de 23 dígitos"
                  value={newRadicado.llave_proceso}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "").slice(0, 23)
                    setNewRadicado({ ...newRadicado, llave_proceso: digitos })
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition placeholder:text-violet-400 focus:ring-4 ${
                    newRadicado.llave_proceso.length > 0 && newRadicado.llave_proceso.length !== 23
                      ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                      : "border-violet-200 bg-violet-50/30 focus:border-violet-400 focus:ring-violet-100"
                  }`}
                  maxLength={23}
                  inputMode="numeric"
                />
                <select
                  aria-label="Categoría del radicado"
                  value={newRadicado.categoria}
                  onChange={(e) => setNewRadicado({ ...newRadicado, categoria: e.target.value })}
                  className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:w-44"
                >
                  <option value="General">General</option>
                  <option value="Trabajo">Trabajo</option>
                  <option value="Consultorio">Consultorio</option>
                </select>
              </div>
              <p className={`text-xs ${newRadicado.llave_proceso.length > 0 && newRadicado.llave_proceso.length !== 23 ? "text-rose-600" : "text-slate-500"}`}>
                {newRadicado.llave_proceso.length === 0
                  ? "Solo números, sin guiones ni espacios."
                  : newRadicado.llave_proceso.length === 23
                    ? "Formato válido."
                    : `${newRadicado.llave_proceso.length} de 23 dígitos.`}
              </p>
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
                    removeCache(cacheKey)
                    removeCache("novedades")
                    await cargarLista(true)
                    toast.success("Radicado agregado exitosamente", { id: loadingToast })
                  } else {
                    toast.error(res.detail || res.message || 'Error al agregar', { id: loadingToast })
                  }
                } catch (err: any) {
                  captureException(err)
                  toast.error(err.message, { id: loadingToast })
                }
              }}
              className="rounded-2xl border border-violet-500 bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-95"
            >
              Agregar
            </button>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-violet-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">Lista de seguimiento</p>
              <h3 className="mt-1 text-base font-semibold text-slate-800 sm:text-lg">Radicados guardados y novedades</h3>
            </div>
            <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-600 sm:text-xs">
              {procesos?.total ?? 0} guardados · {novedades?.total ?? 0} novedades
              {ultimaSync ? <span className="hidden sm:inline"> · sincronizado {tiempoRelativo(ultimaSync)}</span> : null}
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-col gap-2 border-b border-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <div className="flex gap-1">
                {["", "General", "Trabajo", "Consultorio"].map((cat) => (
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
              ref={searchRef}
              aria-label="Buscar por radicado, parte o juzgado"
              title="Buscar (atajo: /)"
              placeholder="Buscar por radicado, parte o juzgado..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
              className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 px-4 py-2 text-sm outline-none transition placeholder:text-violet-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:w-80"
            />
          </div>

          <div className="min-h-0 flex-1 border-t border-violet-50">
            {loadingLista ? (
              <div className="flex flex-col gap-2 px-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-3">
                    <div className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-violet-200" />
                    <div className="h-3 w-[18ch] animate-pulse rounded bg-violet-100" />
                    <div className="ml-auto h-3 w-[10ch] animate-pulse rounded bg-violet-100" />
                    <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-violet-100" />
                  </div>
                ))}
              </div>
            ) : procesos ? (
              <TablaProcesos procesos={procesos.procesos} onOpenDetalle={abrirDetalle} onDelete={() => { removeCache(cacheKey); removeCache("novedades"); cargarLista(true) }} />
            ) : null}
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
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 font-semibold text-violet-600">
              Página {page} de {procesos?.total_paginas ?? 1}
            </div>
            <select
              aria-label="Procesos por página"
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}
              className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 outline-none transition hover:bg-violet-50"
            >
              <option value={25}>25/pág</option>
              <option value={50}>50/pág</option>
              <option value={100}>100/pág</option>
            </select>
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
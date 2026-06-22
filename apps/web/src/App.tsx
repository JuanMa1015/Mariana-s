import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { getProceso, getProcesos, getNovedades, postAddRadicado, postSync } from "./api"
import { getCache, setCache, removeCache } from "./api/cache"
import toast from "react-hot-toast"
import * as Sentry from "@sentry/react"
import type { DetalleProceso, ListaProcesos, ListaNovedades, ResultadoSync } from "./types"
import TablaProcesos from "./components/TablaProcesos"
import DetalleView from "./components/DetalleView"
import { useNavigate } from "react-router-dom"

const FRASES: string[] = [
  "La justicia es la constante y perpetua voluntad de dar a cada uno su derecho. — Ulpiano",
  "El derecho es el conjunto de condiciones que permiten a la libertad de cada uno acomodarse a la libertad de todos. — Kant",
  "Donde hay justicia no hay pobreza. — Séneca",
  "El abogado no es dueño de la verdad, es dueño de la argumentación. — Anónimo",
  "La ley es razón libre de pasión. — Aristóteles",
  "Un buen abogado conoce el derecho; un gran abogado conoce al juez. — Anónimo",
  "La justicia tarda, pero llega. — Refrán popular",
  "El estudio del derecho no solo te enseña leyes, te enseña a pensar. — Anónimo",
  "La libertad sin ley es anarquía; la ley sin libertad es tiranía. — Simón Bolívar",
  "La perseverancia es la madre de la justicia. — Anónimo",
  "No hay causa perdida, solo abogados que se rinden. — Anónimo",
  "De la UdeA para el mundo: orgullo, compromiso y excelencia. — Anónimo",
  "El derecho es la arquitectura de la convivencia social. — Anónimo",
  "Lo importante no es ganar el caso, es hacer justicia. — Anónimo",
  "Estudiar derecho es aprender a construir un mundo más justo. — Anónimo",
  "La UdeA no te da un título, te da una herramienta para cambiar el país. — Anónimo",
  "El mejor abogado no es el que más leyes sabe, sino el que más entiende a las personas. — Anónimo",
  "Los procesos se ganan en los detalles. — Anónimo",
  "La verdad no necesita abogado, pero agradece tener uno bueno. — Anónimo",
  "La justicia sin fuerza es impotente; la fuerza sin justicia es tiranía. — Pascal",
  "Un abogado es un poeta del deber. — Anónimo",
  "La ley debe ser como la muerte, que no exceptúa a nadie. — Montesquieu",
  "En la UdeA aprendí que el derecho sirve para algo más que para ganar plata. — Anónimo",
  "La duda es el principio de la sabiduría jurídica. — Anónimo",
  "Un caso difícil no se gana en el juzgado, se gana en la preparación. — Anónimo",
  "El derecho penal es el derecho del miedo; el derecho civil es el derecho de la confianza. — Anónimo",
  "Estudiar en la UdeA es entender que Colombia necesita abogados con conciencia social. — Anónimo",
  "El que no conoce sus derechos, no puede exigirlos. — Anónimo",
  "La abogacía no es una carrera para hacerse rico, es una carrera para hacerse útil. — Anónimo",
  "La justicia es el pan de los pueblos. — Anónimo",
  "Un abogado sin ética es un ladrón con toga. — Anónimo",
  "El derecho nace del conflicto, pero busca la paz. — Anónimo",
]

export default function App() {
  const navigate = useNavigate()
  const username = localStorage.getItem("username") || localStorage.getItem("email")?.split("@")[0] || "Mariana"
  const frase = useMemo(() => FRASES[Math.floor(Math.random() * FRASES.length)], [])

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

  const searchParams = new URLSearchParams(window.location.search)
  const view = searchParams.get("view")
  const radicadoDetalle = searchParams.get("radicado")

  const esDetalle = view === "detalle" && Boolean(radicadoDetalle)
  const fetchingRef = useRef(false)

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
      Sentry.captureException(err)
      toast.error("Error al sincronizar. Intenta de nuevo.", { id: loadingToast })
    } finally {
      setSyncing(false)
    }
  }, [syncing, cacheKey, cargarLista])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("email")
    localStorage.removeItem("username")
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f3ff] text-slate-900">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-400">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">{saludo}, {username}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
            >
              <svg className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sincronizar"}</span>
            </button>
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
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 sm:px-4 sm:py-2 sm:text-sm"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-none flex-1 min-h-0 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
        {apiOffline && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
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
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
            <span className="font-semibold">Sincronizacion completada:</span>{' '}
            {syncResult.nuevos} nuevo{syncResult.nuevos !== 1 ? "s" : ""},{" "}
            {syncResult.actualizados} actualizado{syncResult.actualizados !== 1 ? "s" : ""},{" "}
            {syncResult.total_consultados} consultado{syncResult.total_consultados !== 1 ? "s" : ""}
            {syncResult.radicados_error_consulta ? (
              <>
                <span className="mx-2 inline-block h-3 w-px bg-emerald-300" />
                <span className="text-rose-600">
                  {syncResult.radicados_error_consulta.length} error{syncResult.radicados_error_consulta.length !== 1 ? "es" : ""}
                </span>
              </>
            ) : null}
          </div>
        )}
        <section className="grid gap-3 md:grid-cols-4">
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
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-slate-900 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-indigo-500">Frase del día</p>
            <p className="mt-1 text-sm leading-snug text-indigo-700">{frase}</p>
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
                <option value="General">General</option>
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
                    removeCache(cacheKey)
                    removeCache("novedades")
                    await cargarLista(true)
                    toast.success("Radicado agregado exitosamente", { id: loadingToast })
                  } else {
                    toast.error(res.detail || res.message || 'Error al agregar', { id: loadingToast })
                  }
                } catch (err: any) {
                  Sentry.captureException(err)
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
              placeholder="Buscar radicado..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
              className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 px-4 py-2 text-sm outline-none transition placeholder:text-violet-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:w-64"
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
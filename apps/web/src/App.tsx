import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { getProceso, getProcesos, getNovedades, postAddRadicado, postSync, getSyncEstado } from "./api"
import { getCache, setCache, removeCache } from "./api/cache"
import toast from "react-hot-toast"
import type { Orden, DetalleProceso, ListaProcesos, ListaNovedades, ResultadoSync, SyncEstado, SyncIniciado } from "./types"
import AvisoPermisoPush from "./components/AvisoPermisoPush"
import Avatar from "./components/Avatar"
import { useAvatar } from "./hooks/useAvatar"
import { cerrarSesion } from "./session"
import TablaProcesos from "./components/TablaProcesos"
import DetalleView from "./components/DetalleView"
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom"
import { captureException } from "./sentry"
import { formatearFechaCorta } from "./utils/fechas"
import { ApiError } from "./api/errors"
import { useTitle } from "./hooks/useTitle"

function tiempoRelativo(fecha: string | null | undefined): string {
  if (!fecha) return "Aún sin sincronizar"
  const t = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(fecha) ? fecha : fecha + "Z").getTime()
  if (isNaN(t)) return "Aún sin sincronizar"
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return "hace un momento"
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} hora${horas !== 1 ? "s" : ""}`
  return formatearFechaCorta(fecha) ?? "Aún sin sincronizar"
}

function fetchProcesosNovedades(skip: number, limit: number, categoria?: string, q?: string, orden?: Orden) {
  return Promise.all([
    getProcesos(undefined, undefined, skip, limit, categoria, q, orden),
    getNovedades(),
  ])
}

const posicionesLista = new Map<string, number>()

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  useTitle("Mis procesos")
  const username = localStorage.getItem("username") || localStorage.getItem("email")?.split("@")[0] || "Mariana"

  const avatar = useAvatar()
  const saludo = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return "Buenos días"
    if (h < 18) return "Buenas tardes"
    return "Buenas noches"
  }, [])
  const [params, setParams] = useSearchParams()
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.get("pagina") || "1", 10) || 1))
  const limit = [25, 50, 100].includes(Number(params.get("limite"))) ? Number(params.get("limite")) : 25
  const filtroCategoria = ["General", "Trabajo", "Consultorio"].includes(params.get("categoria") || "") ? params.get("categoria")! : ""
  const orden: Orden = params.get("orden") === "reciente" || params.get("orden") === "antigua" ? params.get("orden") as Orden : "novedad"
  const busqueda = params.get("q") || ""
  const [busquedaInput, setBusquedaInput] = useState(busqueda)
  const [busquedaAnterior, setBusquedaAnterior] = useState(busqueda)
  if (busquedaAnterior !== busqueda) {
    setBusquedaAnterior(busqueda)
    setBusquedaInput(busqueda)
  }
  const actualizarFiltros = (cambios: Record<string, string | number>) => {
    const siguiente = new URLSearchParams(params)
    for (const [key, value] of Object.entries(cambios)) {
      if (value === "") siguiente.delete(key)
      else siguiente.set(key, String(value))
    }
    setParams(siguiente, { replace: true })
  }
  useEffect(() => {
    if (busquedaInput === busqueda) return
    const timer = setTimeout(() => {
      setParams((prev) => {
        const siguiente = new URLSearchParams(prev)
        if (busquedaInput) siguiente.set("q", busquedaInput)
        else siguiente.delete("q")
        siguiente.set("pagina", "1")
        return siguiente
      }, { replace: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaInput, busqueda, setParams])

  const cacheKey = `lista:${page}:${limit}:${filtroCategoria || ""}:${busqueda || ""}:${orden}`

  const [procesos, setProcesos] = useState<ListaProcesos | null>(() => getCache<ListaProcesos>(cacheKey))
  const [novedades, setNovedades] = useState<ListaNovedades | null>(() => getCache<ListaNovedades>("novedades"))
  const [newRadicado, setNewRadicado] = useState({ llave_proceso: "", categoria: "General" })
  const [detalle, setDetalle] = useState<{ llave: string; data: DetalleProceso | null; error?: string } | null>(null)
  const [reintentoDetalle, setReintentoDetalle] = useState(0)
  const [errorLista, setErrorLista] = useState("")
  const [consultadoEn, setConsultadoEn] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<ResultadoSync | null>(null)

  const [loadedKey, setLoadedKey] = useState<string | null>(() => (getCache<ListaProcesos>(cacheKey) ? cacheKey : null))
  const loadingLista = loadedKey !== cacheKey && !errorLista

  const ultimaSync = useMemo(() => {
    // El backend devuelve la maxima sincronizacion de TODOS los radicados;
    // si el dato no esta (cache previa), se cae al maximo de la pagina actual.
    if (procesos?.ultima_sincronizacion_global) return procesos.ultima_sincronizacion_global
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

  // Las novedades son un conteo global (no dependen del filtro actual).
  const pendientes = novedades?.total ?? 0
  const hayFiltro = Boolean(filtroCategoria || busqueda)

  const { llaveProceso } = useParams()
  const esDetalle = Boolean(llaveProceso)
  const fetchSeq = useRef(0)
  const searchRef = useRef<HTMLInputElement>(null)

  // Unica via de carga: ignora respuestas obsoletas si una peticion mas nueva
  // ya fue emitida (evita condiciones de carrera sin bloquear recargas).
  const cargarLista = useCallback(async () => {
    const seq = ++fetchSeq.current
    const skip = (page - 1) * limit
    try {
      const [p, n] = await fetchProcesosNovedades(skip, limit, filtroCategoria || undefined, busqueda || undefined, orden)
      if (seq !== fetchSeq.current) return
      setErrorLista("")
      setConsultadoEn(new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }))
      setProcesos(p)
      setNovedades(n)
      setLoadedKey(cacheKey)
      setCache(cacheKey, p)
      setCache("novedades", n)
    } catch {
      if (seq === fetchSeq.current) setErrorLista("No pudimos actualizar esta lista. Revisa tu conexión y vuelve a intentar.")
    }
  }, [page, limit, filtroCategoria, busqueda, orden, cacheKey])

  useEffect(() => {
    // Se difiere a microtask para no disparar un render en cascada sincrono
    void Promise.resolve().then(() => { setErrorLista(""); return cargarLista() })
    return () => { fetchSeq.current += 1 }
  }, [cargarLista])

  // ── Estado de conexion ────────────────────────────────────────────────────────
  // Render (plan gratuito) apaga el servicio tras ~15 min de inactividad y
  // despertarlo toma 30-60s. En vez de asustar con "API no disponible",
  // se distinguen tres estados con lenguaje cotidiano para los usuarios.
  type EstadoConexion = "ok" | "conectando" | "sin_conexion"
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexion>("ok")
  const fallosSeguidos = useRef(0)
  const estadoPrevio = useRef<EstadoConexion>("ok")
  // Ultima version de cargarLista accesible sin recrear verificarConexion
  const cargarListaRef = useRef(cargarLista)
  useEffect(() => {
    cargarListaRef.current = cargarLista
  }, [cargarLista])

  const verificarConexion = useCallback(async () => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/healthz`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      fallosSeguidos.current = 0
      estadoPrevio.current = "ok"
      setEstadoConexion((prev) => {
        // Al recuperar la conexion se recarga la lista una sola vez
        if (prev !== "ok") void Promise.resolve().then(() => cargarListaRef.current())
        return "ok"
      })
    } catch {
      fallosSeguidos.current += 1
      const nuevo: EstadoConexion = fallosSeguidos.current >= 4 ? "sin_conexion" : "conectando"
      estadoPrevio.current = nuevo
      setEstadoConexion(nuevo)
    }
  }, [])

  useEffect(() => {
    void verificarConexion()
    // Poll de 60s contra /healthz (sin BD): detecta si la API esta viva sin
    // despertar el compute de Neon (cada check de /health abre una conexion).
    const id = setInterval(verificarConexion, 60000)
    return () => clearInterval(id)
  }, [verificarConexion])


  const currentDetalle = detalle && detalle.llave === llaveProceso ? detalle.data : null
  const errorDetalle = detalle?.llave === llaveProceso ? detalle?.error : undefined
  const loadingDetalle = esDetalle && currentDetalle === null && !errorDetalle

  useEffect(() => {
    if (!esDetalle || !llaveProceso) return
    let activa = true
    void Promise.resolve().then(() => { if (activa) setDetalle(null) })
    getProceso(llaveProceso)
      .then((d) => { if (activa) setDetalle({ llave: llaveProceso, data: d }) })
      .catch((error: unknown) => {
        if (activa) setDetalle({ llave: llaveProceso, data: null, error: error instanceof ApiError && error.status === 404
          ? "El expediente no existe o ya no está en tu lista de seguimiento."
          : "No pudimos cargar el expediente. Revisa tu conexión y vuelve a intentar." })
      })
    return () => { activa = false }
  }, [esDetalle, llaveProceso, reintentoDetalle])

  const abrirDetalle = (llave: string) => {
    posicionesLista.set(cacheKey, window.scrollY)
    navigate(`/procesos/${llave}?${params.toString()}`)
  }

  const volverLista = () => {
    navigate(location.state?.from === "/novedades" ? "/novedades" : `/procesos?${params.toString()}`)
  }

  useEffect(() => {
    if (esDetalle || loadingLista) return
    const frame = requestAnimationFrame(() => window.scrollTo({ top: posicionesLista.get(cacheKey) ?? 0 }))
    return () => cancelAnimationFrame(frame)
  }, [esDetalle, loadingLista, cacheKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const enInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      if (el?.closest('[role="dialog"], [role="alertdialog"]')) return
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
        navigate(`/procesos?${params.toString()}`)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate, esDetalle, params])

  const handleSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setSyncResult(null)
    const loadingToast = toast.loading("Sincronizando con Rama Judicial...")
    try {
      const inicio: SyncIniciado = await postSync()
      if (!inicio.iniciado && !inicio.en_curso) {
        toast(inicio.mensaje || "Ya hay una sincronización en curso", { id: loadingToast })
        return
      }
      // El sync corre en segundo plano en el backend; consultamos su estado.
      const MAX_INTENTOS = 75 // ~5 min con intervalo de 4s
      for (let i = 0; i < MAX_INTENTOS; i++) {
        await new Promise((r) => setTimeout(r, 4000))
        const estado: SyncEstado = await getSyncEstado()
        if (estado.en_curso) continue
        if (estado.error || !estado.resultado) {
          captureException(estado.error || "sync sin resultado")
          toast.error(estado.error || "Error al sincronizar. Intenta de nuevo.", { id: loadingToast })
          return
        }
        const result: ResultadoSync = estado.resultado
        setSyncResult(result)
        const incompleta = (result.errores_app ?? 0) > 0 || (result.errores_rama ?? 0) > 0 || Boolean(result.radicados_saltados_rama?.length)
        if (incompleta) {
          toast.error("Consulta parcial. Algunos expedientes siguen pendientes de verificar.", { id: loadingToast, duration: 7000 })
        } else {
          toast.success(
            `Sincronización completa: ${result.nuevos} nuevos, ${result.actualizados} actualizados, ${result.total_consultados} consultados`,
            { id: loadingToast, duration: 5000 },
          )
        }
        removeCache(cacheKey)
        removeCache("novedades")
        await cargarLista()
        return
      }
      toast("La sincronización sigue en curso; los datos aparecerán al terminar.", {
        id: loadingToast,
        duration: 6000,
        icon: "⏳",
      })
    } catch (err) {
      captureException(err)
      toast.error("Error al sincronizar. Intenta de nuevo.", { id: loadingToast })
    } finally {
      setSyncing(false)
    }
  }, [syncing, cacheKey, cargarLista])

  const handleLogout = async () => {
    await cerrarSesion()
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-indigo-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Mariana's</p>
            <h1 className="text-lg font-bold tracking-tight text-slate-800 sm:text-2xl">
              <span className="sm:hidden">Mis procesos</span>
              <span className="hidden sm:inline">{saludo}, {username}</span>
            </h1>
            <p className="truncate text-xs text-slate-600 sm:hidden">{username}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              aria-label="Sincronizar procesos con Rama Judicial"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
            >
              <svg className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              <span>{syncing ? "Sincronizando..." : "Sincronizar"}</span>
            </button>
            <button
              onClick={() => navigate("/novedades")}
              aria-label="Ver novedades"
              className="hidden items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 sm:inline-flex sm:px-4 sm:py-2 sm:text-sm"
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
              className="hidden items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 sm:inline-flex sm:px-4 sm:py-2 sm:text-sm"
            >
              <span className="hidden sm:inline">Consulta oficial</span>
              <span aria-hidden="true">↗</span>
            </a>
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:px-4 sm:py-2 sm:text-sm"
            >
              Salir
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate("/ajustes")}
            aria-label="Perfil y ajustes"
            title="Perfil y ajustes"
            className="shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-indigo-200 focus-visible:ring-indigo-300 sm:ml-3"
          >
            <Avatar nombre={username} url={avatar} tamano="h-10 w-10" />
          </button>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto flex w-full max-w-none flex-1 min-h-0 flex-col gap-3 px-4 py-4 pb-24 sm:px-5 sm:py-5 sm:pb-5">
        <AvisoPermisoPush />
        {estadoConexion === "conectando" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm no-print">
            Conectando con la aplicación… si acabas de entrar, puede tardar unos segundos. En un momento verás tus procesos.
          </div>
        )}
        {estadoConexion === "sin_conexion" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm no-print">
            <span>
              No hay conexión en este momento. <strong>Tranquilo, tus procesos no se han perdido:</strong> estás viendo los datos tal como quedaron en tu última visita. Seguimos reconectando automáticamente.
            </span>
            <button
              type="button"
              onClick={verificarConexion}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              Reintentar ahora
            </button>
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
            ) : currentDetalle ? (
              <DetalleView detalle={currentDetalle} onVolver={volverLista} onActualizado={() => { setReintentoDetalle((i) => i + 1); removeCache(cacheKey); removeCache("novedades"); void cargarLista() }} />
            ) : (
              <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                <p>{errorDetalle}</p>
                <div className="mt-4 flex gap-3">
                  <button className="rounded-xl border px-4 py-3 font-semibold" onClick={() => { setDetalle(null); setReintentoDetalle((i) => i + 1) }}>Reintentar expediente</button>
                  <button className="rounded-xl border px-4 py-3 font-semibold" onClick={volverLista}>Volver a procesos</button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
        {errorLista && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{errorLista}</p>
            {loadedKey === cacheKey && <p>Mostrando la última lista disponible en esta sesión.</p>}
            <button className="mt-2 min-h-11 rounded-lg border px-3 font-semibold" onClick={() => { void cargarLista() }}>Reintentar lista</button>
          </div>
        )}
        {consultadoEn && <p role="status" className="text-xs text-slate-600">Lista consultada el {consultadoEn}. Revisa la fecha de verificación de cada expediente.</p>}
        {syncResult && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm no-print">
            <span className="font-semibold">Resultado de la consulta:</span>{' '}
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
                  {((syncResult.errores_rama ?? 0) + (syncResult.radicados_saltados_rama?.length ?? 0))} pendientes por fallos de Rama Judicial
                </span>
              </>
            ) : null}
          </div>
        )}
        <section className="flex flex-col gap-2 no-print">
          {pendientes > 0 ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
              <p className="text-sm font-semibold">
                {pendientes} proceso{pendientes !== 1 ? "s" : ""} requiere{pendientes !== 1 ? "n" : ""} revisión
                <span className="block font-normal text-amber-800">Tienen actuaciones nuevas sin revisar.</span>
              </p>
              <button
                type="button"
                onClick={() => navigate("/novedades")}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 active:scale-95"
              >
                Revisar novedades
              </button>
            </div>
          ) : novedades && !errorLista ? (
            <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm">
              No hay novedades pendientes en la última consulta.
            </div>
          ) : null}
          <p className="px-1 text-xs text-slate-600">
            {procesos?.total ?? 0} proceso{(procesos?.total ?? 0) !== 1 ? "s" : ""} {hayFiltro ? ((procesos?.total ?? 0) === 1 ? "coincide con tu búsqueda" : "coinciden con tu búsqueda") : "guardados"}
            {" · "}
            {ultimaSync ? `Consulta más reciente entre tus procesos ${tiempoRelativo(ultimaSync)}` : "Aún sin sincronizar: agrega un radicado y pulsa Sincronizar"}
          </p>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  aria-label="Radicado de 23 dígitos"
                  placeholder="Radicado de 23 dígitos"
                  value={newRadicado.llave_proceso}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "").slice(0, 23)
                    setNewRadicado({ ...newRadicado, llave_proceso: digitos })
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition placeholder:text-indigo-400 focus:ring-4 ${
                    newRadicado.llave_proceso.length > 0 && newRadicado.llave_proceso.length !== 23
                      ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                      : "border-indigo-200 bg-indigo-50/30 focus:border-indigo-400 focus:ring-indigo-100"
                  }`}
                  maxLength={23}
                  inputMode="numeric"
                />
                <select
                  aria-label="Categoría del radicado"
                  value={newRadicado.categoria}
                  onChange={(e) => setNewRadicado({ ...newRadicado, categoria: e.target.value })}
                  className="w-full rounded-2xl border border-indigo-200 bg-indigo-50/30 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:w-44"
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
                if (agregando) return
                setAgregando(true)
                const loadingToast = toast.loading("Agregando radicado...")
                try {
                  const res = await postAddRadicado(newRadicado)
                  if (res.created) {
                    setNewRadicado({ llave_proceso: "", categoria: "General" })
                    removeCache(cacheKey)
                    removeCache("novedades")
                    await cargarLista()
                    toast.success("Radicado agregado exitosamente", { id: loadingToast })
                  } else {
                    toast.error(res.detail || res.message || 'Error al agregar', { id: loadingToast })
                  }
                } catch (err) {
                  captureException(err)
                  toast.error(err instanceof Error ? err.message : "Error al agregar", { id: loadingToast })
                } finally {
                  setAgregando(false)
                }
              }}
              disabled={agregando}
              className="rounded-2xl border border-indigo-500 bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95"
            >
              {agregando ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-indigo-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Lista de seguimiento</p>
              <h3 className="mt-1 text-base font-semibold text-slate-800 sm:text-lg">Radicados guardados y novedades</h3>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-col gap-2 border-b border-indigo-50 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
                {["", "General", "Trabajo", "Consultorio"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => actualizarFiltros({ categoria: cat, pagina: 1 })}
                  aria-pressed={filtroCategoria === cat}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                    filtroCategoria === cat
                      ? "bg-indigo-200 text-indigo-800"
                      : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                  }`}
                >
                  {cat || "Todas"}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-96">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                aria-label="Buscar por radicado, cliente, parte o juzgado"
                title="Buscar (atajo: /)"
                placeholder="Buscar radicado o cliente"
                value={busquedaInput}
                onChange={(e) => setBusquedaInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 sm:block" aria-hidden="true">/</kbd>
            </div>
          </div>

          <div className="min-h-0 flex-1 border-t border-indigo-50">
            {loadingLista ? (
              <div className="flex flex-col gap-2 px-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-4 py-3">
                    <div className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-indigo-200" />
                    <div className="h-3 w-[18ch] animate-pulse rounded bg-indigo-100" />
                    <div className="ml-auto h-3 w-[10ch] animate-pulse rounded bg-indigo-100" />
                    <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-indigo-100" />
                  </div>
                ))}
              </div>
            ) : procesos && loadedKey === cacheKey ? (
              <TablaProcesos hayFiltro={hayFiltro} orden={orden} onOrden={(o) => actualizarFiltros({ orden: o, pagina: 1 })} procesos={procesos.procesos} onOpenDetalle={abrirDetalle} onDelete={() => { removeCache(cacheKey); removeCache("novedades"); cargarLista() }} />
            ) : null}
          </div>
        </section>
        <div className="flex items-center justify-between px-1 pt-1 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => actualizarFiltros({ pagina: Math.max(1, page - 1) })}
            disabled={page <= 1}
            className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-600">
              Página {page} de {procesos?.total_paginas ?? 1}
            </div>
            <select
              aria-label="Procesos por página"
              value={limit}
              onChange={(e) => actualizarFiltros({ limite: Number(e.target.value), pagina: 1 })}
              className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 outline-none transition hover:bg-indigo-50"
            >
              <option value={25}>25/pág</option>
              <option value={50}>50/pág</option>
              <option value={100}>100/pág</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => actualizarFiltros({ pagina: page + 1 })}
            disabled={page >= (procesos?.total_paginas ?? 1)}
            className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
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

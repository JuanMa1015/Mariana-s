import { useState, useCallback, useRef, useEffect, useId, type CSSProperties } from "react"
import { VariableSizeList } from "react-window"
import type { Proceso, Orden } from "../types"
import toast from "react-hot-toast"
import { deleteProceso, updateProceso } from "../api"
import { formatearFechaCorta } from "../utils/fechas"
import { formatearRadicado } from "../utils/radicado"
import { CategoriaBadge, EstadoBadge } from "./Badges"
import Modal from "./Modal"

interface FilaData {
  procesos: Proceso[]
  abierto: string | null
  toggleExpand: (llave: string) => void
  onOpenDetalle: (llaveProceso: string) => void
  handleCopy: (e: React.MouseEvent, llave: string) => void
  pedirBorrar: (e: React.MouseEvent, llave: string) => void
  abrirEditor: (llave: string) => void
}

interface ListChildProps {
  index: number
  style: CSSProperties
  data: FilaData
}

const useContainerHeight = (ref: React.RefObject<HTMLDivElement | null>) => {
  const [height, setHeight] = useState(400)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return height
}

// La tabla de 8 columnas necesita ~960px; por debajo se usan tarjetas.
const CONSULTA_ESCRITORIO = "(min-width: 1024px)"
const useEsEscritorio = () => {
  const [esEscritorio, setEsEscritorio] = useState(
    () => typeof window.matchMedia !== "function" || window.matchMedia(CONSULTA_ESCRITORIO).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const m = window.matchMedia(CONSULTA_ESCRITORIO)
    const alCambiar = () => setEsEscritorio(m.matches)
    m.addEventListener("change", alCambiar)
    return () => m.removeEventListener("change", alCambiar)
  }, [])
  return esEscritorio
}

interface Props {
  procesos: Proceso[]
  onOpenDetalle: (llaveProceso: string) => void
  onDelete?: (llaveProceso: string) => void
  /** Hay búsqueda o filtro activo (cambia el mensaje del estado vacío). */
  hayFiltro?: boolean
  /** Orden activo y callback: el servidor ordena antes de paginar. */
  orden?: Orden
  onOrden?: (orden: Orden) => void
}

const ROW_HEIGHT = 73
// Suficiente para el panel de informacion expandido (grid de 2/3 columnas);
// un valor menor recortaba el contenido en pantallas medianas/angostas.
const EXPANDED_HEIGHT = 560

const IconExternalLink = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
  </svg>
)

const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
  </svg>
)

const IconClipboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M13.887 3.182c.396.037.79.08 1.183.128C16.194 3.45 17 4.414 17 5.517V16.75A2.25 2.25 0 0 1 14.75 19h-9.5A2.25 2.25 0 0 1 3 16.75V5.517c0-1.103.806-2.068 1.93-2.207.393-.048.787-.09 1.183-.128A3.001 3.001 0 0 1 9 1h2c1.373 0 2.543.923 2.887 2.182ZM7.5 4A1.5 1.5 0 0 1 9 2.5h2A1.5 1.5 0 0 1 12.5 4v.5h-5V4Z" clipRule="evenodd" />
  </svg>
)

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 3.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
  </svg>
)

const IconPencil = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
  </svg>
)

const IconChevronDown = ({ open }: { open: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
  >
    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
  </svg>
)

const botonIcono = "inline-flex items-center justify-center rounded-xl border bg-white p-2 shadow-sm transition active:scale-95"

/** Acciones por proceso, compartidas por la fila de escritorio y la tarjeta móvil. */
function Acciones({ p, data, compacto = false }: { p: Proceso; data: FilaData; compacto?: boolean }) {
  const { onOpenDetalle, abrirEditor, handleCopy, pedirBorrar } = data
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={(e) => { e.stopPropagation(); onOpenDetalle(p.llave_proceso) }} title="Ver actuaciones" className={`inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 ${compacto ? "min-h-10 flex-1 justify-center" : ""}`}><IconEye /><span>Detalle</span></button>
      {!compacto && <a href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion" target="_blank" rel="noreferrer" title="Abrir en Rama Judicial" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 active:scale-95"><IconExternalLink /><span>Oficial</span></a>}
      <button type="button" onClick={(e) => { e.stopPropagation(); abrirEditor(p.llave_proceso) }} title="Editar radicado" aria-label="Editar radicado" className={`${botonIcono} border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-600 ${compacto ? "min-h-10 min-w-10" : ""}`}><IconPencil /></button>
      <button type="button" onClick={(e) => handleCopy(e, p.llave_proceso)} title="Copiar radicado" aria-label="Copiar radicado" className={`${botonIcono} border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 ${compacto ? "min-h-10 min-w-10" : ""}`}><IconClipboard /></button>
      <button type="button" onClick={(e) => pedirBorrar(e, p.llave_proceso)} title="Eliminar radicado" aria-label="Eliminar radicado" className={`${botonIcono} border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 ${compacto ? "min-h-10 min-w-10" : ""}`}><IconTrash /></button>
    </div>
  )
}

function Row({ index, style, data }: ListChildProps) {
  const { procesos, abierto, toggleExpand } = data
  const p = procesos[index]
  const isOpen = abierto === p.llave_proceso
  const barra = p.notificado ? "bg-emerald-500" : "bg-amber-400"
  const alternar = () => toggleExpand(p.llave_proceso)

  return (
    <div style={style}>
      <table className="w-full text-left text-sm border-separate border-spacing-0">
        <tbody>
          <tr
            tabIndex={0}
            aria-expanded={isOpen}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                alternar()
              }
            }}
            className={`group cursor-pointer border-b border-slate-100 transition-colors duration-150 ${isOpen ? "bg-white" : "bg-white hover:bg-indigo-50/70"}`}
            onClick={alternar}
          >
            <td className="relative px-5 py-4 align-middle">
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${barra} rounded-r`} />
              <div className="flex items-center gap-2.5">
                <div className={`${isOpen ? "text-slate-400" : "text-slate-300 group-hover:text-sky-400"} transition-colors`}>
                  <IconChevronDown open={isOpen} />
                </div>
                <div>
                  <span className="block font-mono text-xs font-bold tracking-wide text-slate-800 leading-tight">
                    {formatearRadicado(p.llave_proceso)}
                  </span>
                  <span className={`mt-0.5 block max-w-[14rem] truncate text-[11px] ${p.alias ? "font-semibold text-slate-700" : "text-slate-500"}`} title={p.alias ?? undefined}>{p.alias || "Radicado principal"}</span>
                </div>
              </div>
            </td>
            <td className="px-5 py-4 align-middle">
              <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2 max-w-[18rem]">
                {p.despacho || <span className="text-slate-500 font-normal italic">Sin despacho</span>}
              </p>
            </td>
            <td className="px-5 py-4 align-middle">
              {p.departamento ? (
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{p.departamento}</span>
              ) : <span className="text-xs text-slate-500 italic">—</span>}
            </td>
            <td className="px-5 py-4 align-middle"><CategoriaBadge categoria={p.categoria} /></td>
            <td className="px-5 py-4 align-middle max-w-[22rem]">
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {p.sujetos_procesales || <span className="italic text-slate-500">Sin sujetos procesales</span>}
              </p>
            </td>
            <td className="px-5 py-4 align-middle">
              {p.fecha_ultima_actuacion ? (
                <><p className="text-sm font-semibold text-slate-800">{formatearFechaCorta(p.fecha_ultima_actuacion)}</p><p className="text-[11px] text-slate-500 mt-0.5">Último cambio</p></>
              ) : <span className="text-xs text-slate-500 italic">Sin actualización</span>}
            </td>
            <td className="px-5 py-4 align-middle"><EstadoBadge notificado={p.notificado} /></td>
            <td className="px-5 py-4 align-middle"><Acciones p={p} data={data} /></td>
          </tr>
          {isOpen && (
            <tr>
              <td colSpan={8} className="border-b border-indigo-50 bg-gradient-to-b from-indigo-50/50 to-white px-6 pb-6 pt-0">
                <div className="mt-1 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3 border-b border-indigo-100 pb-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500">Información del proceso</p>
                      <h4 className="mt-1 font-mono text-sm font-bold tracking-wide text-slate-900">{formatearRadicado(p.llave_proceso)}</h4>
                    </div>
                    <EstadoBadge notificado={p.notificado} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    {[
                      { label: "Tipo de proceso", value: p.tipo_proceso },
                      { label: "Clase", value: p.clase_proceso },
                      { label: "Categoría", value: p.categoria || "General" },
                      { label: "Privado", value: p.es_privado ? "Sí" : "No" },
                      { label: "Fecha del proceso", value: p.fecha_proceso },
                      { label: "Registrado el", value: p.creado_en ? new Date(p.creado_en).toLocaleString("es-CO") : null },
                      { label: "Última actualización", value: p.actualizado_en ? new Date(p.actualizado_en).toLocaleString("es-CO") : null },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                        <p className="mt-1.5 text-sm font-medium text-slate-800">
                          {value ?? <span className="text-slate-500 italic font-normal">Sin dato</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Tarjeta para pantallas angostas: lo esencial del proceso y sus acciones. */
function Tarjeta({ p, data }: { p: Proceso; data: FilaData }) {
  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${p.notificado ? "border-slate-200" : "border-amber-300"}`}>
      {p.alias && <p className="truncate text-sm font-bold text-slate-900">{p.alias}</p>}
      <span className="block whitespace-nowrap font-mono text-[13px] font-bold text-slate-800">{formatearRadicado(p.llave_proceso)}</span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <EstadoBadge notificado={p.notificado} />
        <CategoriaBadge categoria={p.categoria} />
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-slate-800">
        {p.despacho || <span className="font-normal italic text-slate-500">Sin despacho</span>}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {p.fecha_ultima_actuacion ? `Última actuación: ${formatearFechaCorta(p.fecha_ultima_actuacion)}` : "Sin actuaciones"}
      </p>
      <div className="mt-3"><Acciones p={p} data={data} compacto /></div>
    </li>
  )
}

function EstadoVacio({ hayFiltro }: { hayFiltro: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-semibold text-slate-700">
        {hayFiltro ? "Ningún proceso coincide con tu búsqueda" : "Aún no tienes procesos guardados"}
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-500">
        {hayFiltro
          ? "Prueba con otro número de radicado, parte o juzgado, o quita el filtro de categoría."
          : <>Agrega tu primer radicado arriba. Son 23 dígitos seguidos, por ejemplo <span className="font-mono">05001 31 03 017 2024 00480 00</span> (escríbelo sin espacios).</>}
      </p>
    </div>
  )
}

export default function TablaProcesos({ procesos, onOpenDetalle, onDelete, hayFiltro = false, orden = "novedad", onOrden }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [porBorrar, setPorBorrar] = useState<string | null>(null)
  const editProceso = procesos.find(p => p.llave_proceso === editando)
  const [editForm, setEditForm] = useState({ llave_proceso: "", categoria: "", alias: "" })
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<VariableSizeList>(null)
  const listHeight = useContainerHeight(containerRef)
  const esEscritorio = useEsEscritorio()
  const idRadicado = useId()
  const idAlias = useId()
  const idCategoria = useId()
  const idOrden = useId()

  const toggleExpand = useCallback((llave: string) => {
    setAbierto(prev => prev === llave ? null : llave)
  }, [])

  const pedirBorrar = useCallback((e: React.MouseEvent, llave: string) => {
    e.stopPropagation()
    setPorBorrar(llave)
  }, [])
  const cerrarBorrar = useCallback(() => setPorBorrar(null), [])
  const cerrarEditor = useCallback(() => setEditando(null), [])

  const confirmarBorrar = async () => {
    const llave = porBorrar
    if (!llave) return
    setPorBorrar(null)
    const loadingToast = toast.loading("Eliminando...")
    try {
      await deleteProceso(llave)
      toast.success("Radicado eliminado", { id: loadingToast })
      if (onDelete) onDelete(llave)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar", { id: loadingToast })
    }
  }

  const handleCopy = useCallback(async (e: React.MouseEvent, llave: string) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(llave)
      toast.success("Radicado copiado al portapapeles")
    } catch {
      toast.error("No se pudo copiar el radicado")
    }
  }, [])

  const abrirEditor = useCallback((llave: string) => {
    const p = procesos.find(x => x.llave_proceso === llave)
    if (p) {
      setEditForm({ llave_proceso: p.llave_proceso, categoria: p.categoria || "General", alias: p.alias ?? "" })
      setEditando(llave)
    }
  }, [procesos])

  const radicadoValido = editForm.llave_proceso.length === 23

  const guardarEdicion = async () => {
    if (!editando || !radicadoValido) return
    const loading = toast.loading("Guardando cambios...")
    try {
      await updateProceso(editando, {
        llave_proceso: editForm.llave_proceso,
        categoria: editForm.categoria,
        alias: editForm.alias.trim(),
      })
      toast.success("Radicado actualizado", { id: loading })
      setEditando(null)
      if (onDelete) onDelete(editando)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar", { id: loading })
    }
  }

  const itemSize = useCallback((index: number) => {
    return abierto === procesos[index]?.llave_proceso ? ROW_HEIGHT + EXPANDED_HEIGHT : ROW_HEIGHT
  }, [abierto, procesos])

  const itemData: FilaData = {
    procesos,
    abierto,
    toggleExpand,
    onOpenDetalle,
    handleCopy,
    pedirBorrar,
    abrirEditor,
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {procesos.length > 0 && (
          <div className="flex shrink-0 items-center justify-end gap-2 px-4 py-2 text-xs text-slate-500 sm:px-5">
            <label htmlFor={idOrden}>Ordenar</label>
            <select
              id={idOrden}
              value={orden}
              onChange={(e) => onOrden?.(e.target.value as Orden)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="novedad">Con novedad primero</option>
              <option value="reciente">Actuación más reciente</option>
              <option value="antigua">Actuación más antigua</option>
            </select>
          </div>
        )}
        {esEscritorio && procesos.length > 0 && (
          <table className="w-full min-w-[960px] text-left text-sm border-separate border-spacing-0 shrink-0">
            <thead className="sticky top-0 z-10">
              <tr>
                {["Radicado", "Despacho", "Departamento", "Categoría", "Sujetos", "Última actuación", "Estado", "Acciones"].map((col) => (
                  <th key={col} className="bg-slate-100 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 first:rounded-tl-2xl last:rounded-tr-2xl">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        )}
        <div ref={containerRef} className={`min-h-0 flex-1 ${esEscritorio ? "" : "overflow-y-auto px-3 pb-3"}`}>
          {procesos.length === 0 ? (
            <EstadoVacio hayFiltro={hayFiltro} />
          ) : esEscritorio ? (
            <VariableSizeList
              ref={listRef}
              height={listHeight}
              itemCount={procesos.length}
              itemSize={itemSize}
              width="100%"
              itemData={itemData}
              overscanCount={5}
              style={{ minWidth: "960px" }}
            >
              {Row}
            </VariableSizeList>
          ) : (
            <ul className="flex flex-col gap-3">
              {procesos.map((p) => <Tarjeta key={p.llave_proceso} p={p} data={itemData} />)}
            </ul>
          )}
        </div>
      </div>

      {porBorrar && (
        <Modal titulo="¿Eliminar este radicado?" role="alertdialog" onClose={cerrarBorrar}>
          <p className="font-mono text-sm text-slate-700">{formatearRadicado(porBorrar)}</p>
          <p className="mt-2 text-sm text-slate-500">Se borrará con todo su historial de actuaciones. Esta acción es irreversible.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={confirmarBorrar} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700">Sí, eliminar</button>
            <button type="button" onClick={cerrarBorrar} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
          </div>
        </Modal>
      )}

      {editando && editProceso && (
        <Modal titulo="Editar radicado" onClose={cerrarEditor}>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor={idAlias} className="mb-1.5 block text-xs font-semibold text-slate-600">Cliente o alias <span className="font-normal text-slate-500">(opcional)</span></label>
              <input
                id={idAlias}
                value={editForm.alias}
                onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })}
                maxLength={100}
                placeholder="Ej: Pérez vs. Bancolombia"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label htmlFor={idRadicado} className="mb-1.5 block text-xs font-semibold text-slate-600">Radicado (23 dígitos)</label>
              <input
                id={idRadicado}
                value={editForm.llave_proceso}
                onChange={(e) => setEditForm({ ...editForm, llave_proceso: e.target.value.replace(/\D/g, "").slice(0, 23) })}
                aria-invalid={!radicadoValido}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-4 ${radicadoValido ? "border-slate-300 focus:border-indigo-400 focus:ring-indigo-100" : "border-rose-300 focus:border-rose-400 focus:ring-rose-100"}`}
                maxLength={23}
                inputMode="numeric"
              />
              <p className={`mt-1 text-xs ${radicadoValido ? "text-slate-500" : "text-rose-600"}`}>
                {radicadoValido ? "Formato válido." : `${editForm.llave_proceso.length} de 23 dígitos.`}
              </p>
            </div>
            <div>
              <label htmlFor={idCategoria} className="mb-1.5 block text-xs font-semibold text-slate-600">Categoría</label>
              <select id={idCategoria} value={editForm.categoria} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="General">General</option>
                <option value="Trabajo">Trabajo</option>
                <option value="Consultorio">Consultorio</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={cerrarEditor} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={guardarEdicion} disabled={!radicadoValido} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">Guardar</button>
          </div>
        </Modal>
      )}
    </>
  )
}

import { useState } from "react"
import toast from "react-hot-toast"
import { updateProceso } from "../api"
import type { Actuacion, DetalleProceso, DocumentoActuacion } from "../types"

interface Props {
  detalle: DetalleProceso
  onVolver: () => void
  onActualizado?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatearFecha(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })
}

function formatearHora(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleString("es-CO", { year: "numeric", month: "long", day: "numeric" })
}

function esHoy(raw: string | null | undefined): boolean {
  if (!raw) return false
  const d = new Date(raw)
  if (isNaN(d.getTime())) return false
  const hoy = new Date()
  return d.toDateString() === hoy.toDateString()
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconArrowLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
  </svg>
)
const IconExternalLink = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
  </svg>
)
const IconClipboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M13.887 3.182c.396.037.79.08 1.183.128C16.194 3.45 17 4.414 17 5.517V16.75A2.25 2.25 0 0 1 14.75 19h-9.5A2.25 2.25 0 0 1 3 16.75V5.517c0-1.103.806-2.068 1.93-2.207.393-.048.787-.09 1.183-.128A3.001 3.001 0 0 1 9 1h2c1.373 0 2.543.923 2.887 2.182ZM7.5 4A1.5 1.5 0 0 1 9 2.5h2A1.5 1.5 0 0 1 12.5 4v.5h-5V4Z" clipRule="evenodd" />
  </svg>
)
const IconScale = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v.258a33.186 33.186 0 0 1 6.668.83.75.75 0 0 1-.336 1.461 31.28 31.28 0 0 0-1.103-.232l1.702 7.545a.75.75 0 0 1-.387.832A4.981 4.981 0 0 1 15 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 0 1-.387-.832l1.77-7.849a31.743 31.743 0 0 0-3.339-.254v11.505a20.01 20.01 0 0 1 3.78.501.75.75 0 1 1-.339 1.462A18.51 18.51 0 0 0 10 17.5c-1.442 0-2.845.165-4.191.477a.75.75 0 0 1-.338-1.462 20.01 20.01 0 0 1 3.779-.501V4.509a31.742 31.742 0 0 0-3.339.254l1.769 7.849a.75.75 0 0 1-.387.832A4.98 4.98 0 0 1 5 14a4.98 4.98 0 0 1-2.294-.556.75.75 0 0 1-.387-.832L4.02 5.067c-.37.07-.738.148-1.103.232a.75.75 0 0 1-.336-1.462 33.186 33.186 0 0 1 6.668-.829V2.75A.75.75 0 0 1 10 2Z" clipRule="evenodd" />
  </svg>
)
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
  </svg>
)
const IconDocument = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
  </svg>
)
const IconChevronDown = ({ open }: { open: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
  </svg>
)

// ── Sub-components ─────────────────────────────────────────────────────────────

const StatusBadge = ({ notificado }: { notificado: boolean }) =>
  notificado ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      Vigente
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
      <span className="h-2 w-2 rounded-full bg-amber-500" />
      Pendiente de revisión
    </span>
  )

const InfoCard = ({ label, value, highlight = false }: { label: string; value?: string | null; highlight?: boolean }) => (
  <div className={`rounded-2xl border p-4 ${highlight ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white shadow-sm"}`}>
    <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${highlight ? "text-sky-600" : "text-slate-400"}`}>{label}</p>
    <p className={`mt-1.5 text-sm font-semibold ${highlight ? "text-sky-900" : "text-slate-800"}`}>
      {value ?? <span className="italic font-normal text-slate-400">Sin dato</span>}
    </p>
  </div>
)

const DocumentosList = ({ docs }: { docs: DocumentoActuacion[] }) => {
  const [open, setOpen] = useState(false)
  if (!docs.length) return null
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800 transition"
      >
        <IconDocument />
        {docs.length} documento{docs.length > 1 ? "s" : ""}
        <IconChevronDown open={open} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {docs.map((doc) => (
            <li key={doc.id_reg_documento} className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
              <p className="font-medium text-slate-700">{doc.nombre}</p>
              {doc.descripcion && <p className="text-slate-400 truncate">{doc.descripcion}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const ActuacionCard = ({ actuacion, isLatest }: { actuacion: Actuacion; isLatest: boolean }) => {
  const esNueva = esHoy(actuacion.fecha_registro)
  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {/* Timeline connector */}
      <div className="absolute left-[11px] top-2 bottom-0 w-0.5 bg-violet-200 last:hidden" />
      <div className={`absolute left-[5px] top-1.5 h-3.5 w-3.5 rounded-full border-2 ${isLatest ? "border-violet-500 bg-violet-300 ring-4 ring-violet-100" : "border-slate-300 bg-white"}`} />

      <div className={`rounded-2xl border p-4 transition ${isLatest ? "border-violet-200 bg-violet-50/50 shadow-sm" : "border-slate-100 bg-white hover:bg-slate-50/50"}`}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-violet-600 whitespace-nowrap">
              {formatearFecha(actuacion.fecha_actuacion)}
            </span>
            {isLatest && (
              <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                Última
              </span>
            )}
            {esNueva && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Hoy
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">{actuacion.cons_actuacion}</span>
        </div>

        <p className="mt-1.5 text-sm font-semibold text-slate-800">{actuacion.actuacion}</p>

        {actuacion.anotacion && (
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{actuacion.anotacion}</p>
        )}

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
          {actuacion.fecha_inicial && <span>Inicio: {formatearFecha(actuacion.fecha_inicial)}</span>}
          {actuacion.fecha_final && <span>Fin: {formatearFecha(actuacion.fecha_final)}</span>}
          {actuacion.fecha_registro && <span>Registro: {formatearFecha(actuacion.fecha_registro)}</span>}
        </div>

        <DocumentosList docs={actuacion.documentos ?? []} />
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────────
export default function DetalleView({ detalle, onVolver, onActualizado }: Props) {
  const [marcando, setMarcando] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(detalle.llave_proceso)
    toast.success("Radicado copiado al portapapeles")
  }

  const handleMarcarLeido = async () => {
    setMarcando(true)
    try {
      await updateProceso(detalle.llave_proceso, { notificado: true })
      toast.success("Marcado como leído")
      if (onActualizado) onActualizado()
    } catch (err: any) {
      toast.error(err.message || "Error al marcar como leído")
    } finally {
      setMarcando(false)
    }
  }

  const actuaciones = detalle.actuaciones ?? []

  const fechaUltima = formatearHora(detalle.fecha_ultima_actuacion)
  const fechaCreado = formatearHora(detalle.creado_en)
  const fechaActualizado = formatearHora(detalle.actualizado_en)

  return (
    <div className="flex flex-col gap-5">
      {/* ── Top nav bar ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 active:scale-95"
        >
          <IconArrowLeft />
          Volver
        </button>
        <div className="flex items-center gap-2">
          {!detalle.notificado && (
            <button
              type="button"
              onClick={handleMarcarLeido}
              disabled={marcando}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
            >
              <IconCheck />
              <span className="hidden sm:block">{marcando ? "Marcando..." : "Marcar como leído"}</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 active:scale-95"
          >
            <IconClipboard />
            <span className="hidden sm:block">Copiar</span>
          </button>
          <a
            href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-400 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 active:scale-95"
          >
            <IconExternalLink />
            <span className="hidden sm:block">Oficial</span>
          </a>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-100 to-indigo-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/20" />
        <div className="pointer-events-none absolute -bottom-8 right-20 h-24 w-24 rounded-full bg-indigo-300/10" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-200 text-violet-600">
              <IconScale />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500">Proceso judicial</p>
              <h2 className="mt-0.5 font-mono text-lg font-bold tracking-widest text-slate-800 leading-tight">
                {detalle.llave_proceso}
              </h2>
            </div>
          </div>
          <StatusBadge notificado={detalle.notificado} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/60 border border-violet-200 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500">Última actuación</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {fechaUltima ?? <span className="italic font-normal text-slate-400">Sin dato</span>}
            </p>
          </div>
          <div className="rounded-xl bg-white/60 border border-violet-200 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500">Tipo</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {detalle.tipo_proceso ?? <span className="italic font-normal text-slate-400">Sin dato</span>}
            </p>
          </div>
          <div className="rounded-xl bg-white/60 border border-violet-200 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500">Clase</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {detalle.clase_proceso ?? <span className="italic font-normal text-slate-400">Sin dato</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Info grid ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InfoCard label="Despacho" value={detalle.despacho} highlight />
        <InfoCard label="Departamento" value={detalle.departamento} />
        <InfoCard label="Privado" value={detalle.es_privado ? "Sí" : "No"} />
        <InfoCard label="Fecha del proceso" value={formatearFecha(detalle.fecha_proceso)} />
        <InfoCard label="Registrado en sistema" value={fechaCreado} />
        <InfoCard label="Última actualización" value={fechaActualizado} />
      </div>

      {/* ── Sujetos procesales ── */}
      {detalle.sujetos_procesales && (
        <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400 mb-3">Sujetos procesales</p>
          <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{detalle.sujetos_procesales}</p>
        </div>
      )}

      {/* ── Actuaciones (Timeline) ── */}
      <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm" id="actuaciones">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Actuaciones</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-800">Historial del proceso</h3>
          </div>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
            {actuaciones.length} registro{actuaciones.length !== 1 ? "s" : ""}
          </span>
        </div>

        {actuaciones.length ? (
          <div className="space-y-0">
            {actuaciones.map((actuacion, i) => (
              <ActuacionCard
                key={actuacion.id_reg_actuacion}
                actuacion={actuacion}
                isLatest={i === 0}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <IconDocument />
            <p className="text-sm">Aún no hay actuaciones guardadas para este radicado.</p>
            <p className="text-xs">Las actuaciones se sincronizarán automáticamente cada 6 horas.</p>
          </div>
        )}
      </div>
    </div>
  )
}

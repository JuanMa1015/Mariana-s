import toast from "react-hot-toast"
import type { DetalleProceso } from "../types"

interface Props {
  detalle: DetalleProceso
  onVolver: () => void
}

// ── Icons ────────────────────────────────────────────────────────────────────
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

// ── Badge ────────────────────────────────────────────────────────────────────
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

// ── Info card ────────────────────────────────────────────────────────────────
const InfoCard = ({ label, value, highlight = false }: { label: string; value?: string | null; highlight?: boolean }) => (
  <div className={`rounded-2xl border p-4 ${highlight ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white shadow-sm"}`}>
    <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${highlight ? "text-sky-600" : "text-slate-400"}`}>{label}</p>
    <p className={`mt-1.5 text-sm font-semibold ${highlight ? "text-sky-900" : "text-slate-800"}`}>
      {value ?? <span className="italic font-normal text-slate-400">Sin dato</span>}
    </p>
  </div>
)

// ── Main component ────────────────────────────────────────────────────────────
export default function DetalleView({ detalle, onVolver }: Props) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(detalle.llave_proceso)
    toast.success("Radicado copiado al portapapeles")
  }

  const fechaUltima = detalle.fecha_ultima_actuacion
    ? new Date(detalle.fecha_ultima_actuacion).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })
    : null

  const fechaCreado = detalle.creado_en
    ? new Date(detalle.creado_en).toLocaleString("es-CO")
    : null

  const fechaActualizado = detalle.actualizado_en
    ? new Date(detalle.actualizado_en).toLocaleString("es-CO")
    : null

  return (
    <div className="flex flex-col gap-5">
      {/* ── Top nav bar ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 active:scale-95"
        >
          <IconArrowLeft />
          Volver a la lista
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 active:scale-95"
          >
            <IconClipboard />
            <span className="hidden sm:block">Copiar radicado</span>
          </button>
          <a
            href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-400 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 active:scale-95"
          >
            <IconExternalLink />
            <span className="hidden sm:block">Consulta oficial</span>
          </a>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-100 to-indigo-50 p-6 shadow-sm">
        {/* Background decorative element */}
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
        <InfoCard label="Fecha del proceso" value={detalle.fecha_proceso} />
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
    </div>
  )
}

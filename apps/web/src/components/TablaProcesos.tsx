import { Fragment, useState } from "react"
import type { Proceso } from "../types"
import toast from "react-hot-toast"
import { deleteProceso, updateProceso } from "../api"

interface Props {
  procesos: Proceso[]
  onOpenDetalle: (llaveProceso: string) => void
  onDelete?: (llaveProceso: string) => void
}

// ─── Icon components ────────────────────────────────────────────────────────
const IconExternalLink = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
  </svg>
)

const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
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

// ─── Component ───────────────────────────────────────────────────────────────
export default function TablaProcesos({ procesos, onOpenDetalle, onDelete }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const editProceso = procesos.find(p => p.llave_proceso === editando)
  const [editForm, setEditForm] = useState({ llave_proceso: "", categoria: "" })

  const handleDelete = async (e: React.MouseEvent, llave: string) => {
    e.stopPropagation()
    toast((t) => (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-slate-800">¿Eliminar este radicado?</p>
        <p className="text-xs text-slate-500 font-mono">{llave}</p>
        <p className="text-xs text-slate-500">Esta acción es irreversible.</p>
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
            onClick={async () => {
              toast.dismiss(t.id)
              const loadingToast = toast.loading("Eliminando...")
              try {
                await deleteProceso(llave)
                toast.success("Radicado eliminado", { id: loadingToast })
                if (onDelete) onDelete(llave)
              } catch (err: any) {
                toast.error(err.message || "Error al eliminar", { id: loadingToast })
              }
            }}
          >
            Sí, eliminar
          </button>
          <button
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: Infinity, style: { background: "#fff", padding: "16px", borderRadius: "16px" } })
  }

  const handleCopy = async (e: React.MouseEvent, llave: string) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(llave)
    toast.success("Radicado copiado al portapapeles")
  }

  const abrirEditor = (llave: string) => {
    const p = procesos.find(x => x.llave_proceso === llave)
    if (p) {
      setEditForm({ llave_proceso: p.llave_proceso, categoria: p.categoria || "General" })
      setEditando(llave)
    }
  }

  const guardarEdicion = async () => {
    if (!editando) return
    const loading = toast.loading("Guardando cambios...")
    try {
      await updateProceso(editando, {
        llave_proceso: editForm.llave_proceso.trim() || undefined,
        categoria: editForm.categoria,
      })
      toast.success("Radicado actualizado", { id: loading })
      setEditando(null)
      if (onDelete) onDelete(editando)
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar", { id: loading })
    }
  }

  return (
    <>
      <div className="h-full overflow-auto">
        <table className="w-full min-w-[960px] text-left text-sm border-separate border-spacing-0">
          {/* ── Header ── */}
          <thead className="sticky top-0 z-10">
            <tr>
              {["Radicado", "Despacho", "Departamento", "Categoría", "Sujetos", "Última actuación", "Estado", "Acciones"].map((col) => (
                <th
                  key={col}
                  className="bg-violet-100 px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-600 first:rounded-tl-2xl last:rounded-tr-2xl"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {procesos.map((p) => {
              const isOpen = abierto === p.llave_proceso
              const statusColor = p.notificado
                ? { bar: "bg-emerald-500", badge: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500", label: "Vigente" }
                : { bar: "bg-amber-400", badge: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-500", label: "Pendiente" }

              return (
                <Fragment key={p.llave_proceso}>
                  {/* ── Main row ── */}
                  <tr
                    className="group cursor-pointer bg-white hover:bg-violet-50/70 transition-colors duration-150"
                    onClick={() => setAbierto(isOpen ? null : p.llave_proceso)}
                  >
                    {/* Left accent bar + radicado */}
                    <td className="relative px-5 py-4 align-middle border-b border-slate-100">
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusColor.bar} rounded-r`} />
                      <div className="flex items-center gap-2.5">
                        <div className="text-slate-300 group-hover:text-sky-400 transition-colors">
                          <IconChevronDown open={isOpen} />
                        </div>
                        <div>
                          <span className="block font-mono text-[11px] font-bold tracking-widest text-slate-800 leading-tight">
                            {p.llave_proceso}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">Radicado principal</span>
                        </div>
                      </div>
                    </td>

                    {/* Despacho */}
                    <td className="px-5 py-4 align-middle border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2 max-w-[18rem]">
                        {p.despacho || <span className="text-slate-400 font-normal italic">Sin despacho</span>}
                      </p>
                    </td>

                    {/* Departamento */}
                    <td className="px-5 py-4 align-middle border-b border-slate-100">
                      {p.departamento ? (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {p.departamento}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Categoría */}
                    <td className="px-5 py-4 align-middle border-b border-slate-100">
                      {p.categoria ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                          p.categoria === "Trabajo"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : p.categoria === "Consultorio"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-violet-200 bg-violet-50 text-violet-700"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            p.categoria === "Trabajo" ? "bg-sky-500" : p.categoria === "Consultorio" ? "bg-amber-500" : "bg-violet-500"
                          }`} />
                          {p.categoria}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Sujetos */}
                    <td className="px-5 py-4 align-middle border-b border-slate-100 max-w-[22rem]">
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {p.sujetos_procesales || <span className="italic text-slate-400">Sin sujetos procesales</span>}
                      </p>
                    </td>

                    {/* Última actuación */}
                    <td className="px-5 py-4 align-middle border-b border-slate-100">
                      {p.fecha_ultima_actuacion ? (
                        <>
                          <p className="text-sm font-semibold text-slate-800">
                            {new Date(p.fecha_ultima_actuacion).toLocaleDateString("es-CO")}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Último cambio</p>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin actualización</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-4 align-middle border-b border-slate-100">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${statusColor.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusColor.dot}`} />
                        {statusColor.label}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-4 align-middle border-b border-slate-100">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Ver detalle */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenDetalle(p.llave_proceso) }}
                          title="Ver actuaciones"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-400 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-violet-500 active:scale-95"
                        >
                          <IconEye />
                          <span>Detalle</span>
                        </button>

                        {/* Consulta oficial */}
                        <a
                          href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir en Rama Judicial"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100 active:scale-95"
                        >
                          <IconExternalLink />
                          <span>Oficial</span>
                        </a>

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); abrirEditor(p.llave_proceso) }}
                          title="Editar radicado"
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm transition hover:bg-amber-50 hover:text-amber-600 active:scale-95"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                          </svg>
                        </button>

                        {/* Copiar */}
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, p.llave_proceso)}
                          title="Copiar radicado"
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm transition hover:bg-violet-50 hover:text-violet-600 active:scale-95"
                        >
                          <IconClipboard />
                        </button>

                        {/* Eliminar */}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, p.llave_proceso)}
                          title="Eliminar radicado"
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-400 shadow-sm transition hover:bg-rose-100 hover:text-rose-600 active:scale-95"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* ── Expanded detail row ── */}
                  {isOpen && (
                    <tr>
                      <td colSpan={8} className="border-b border-violet-50 bg-gradient-to-b from-violet-50/50 to-white px-6 pb-6 pt-0">
                        <div className="mt-3 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                          {/* Header */}
                          <div className="mb-4 flex items-start justify-between gap-3 border-b border-violet-100 pb-4">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500">Información del proceso</p>
                              <h4 className="mt-1 font-mono text-sm font-bold tracking-widest text-slate-900">{p.llave_proceso}</h4>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${statusColor.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusColor.dot}`} />
                              {statusColor.label}
                            </span>
                          </div>

                          {/* Cards grid */}
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                                <p className="mt-1.5 text-sm font-medium text-slate-800">
                                  {value ?? <span className="text-slate-400 italic font-normal">Sin dato</span>}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Edit modal ── */}
      {editando && editProceso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditando(null)}>
          <div className="w-full max-w-md rounded-3xl border border-violet-100 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-500 mb-1">Editar radicado</p>
            <h3 className="text-lg font-bold text-slate-800 mb-5">Modificar datos</h3>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Radicado</label>
                <input
                  value={editForm.llave_proceso}
                  onChange={(e) => setEditForm({ ...editForm, llave_proceso: e.target.value.replace(/\D/g, "") })}
                  className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  maxLength={23}
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Categoría</label>
                <select
                  value={editForm.categoria}
                  onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })}
                  className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                >
                  <option value="General">General</option>
                  <option value="Trabajo">Trabajo</option>
                  <option value="Consultorio">Consultorio</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditando(null)}
                className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                className="rounded-2xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 active:scale-95"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
import { Fragment, useState } from "react"
import type { Proceso } from "../types"

interface Props {
  procesos: Proceso[]
  onOpenDetalle: (llaveProceso: string) => void
  onDelete?: (llaveProceso: string) => void
}

export default function TablaProcesos({ procesos, onOpenDetalle }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null)

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-slate-50 to-white">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-200/70 text-[11px] uppercase tracking-[0.18em] text-slate-700 shadow-sm">
          <tr>
            <th className="px-6 py-4 font-semibold">Radicado</th>
            <th className="px-6 py-4 font-semibold">Despacho</th>
            <th className="px-6 py-4 font-semibold">Departamento</th>
            <th className="px-6 py-4 font-semibold">Sujetos</th>
            <th className="px-6 py-4 font-semibold">Última actuación</th>
            <th className="px-6 py-4 font-semibold">Estado</th>
            <th className="px-6 py-4 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white align-top">
          {procesos.map((p, index) => {
            const rowTone = p.notificado
              ? "border-l-4 border-l-sky-300"
              : "border-l-4 border-l-amber-200"
            const zebra = index % 2 === 0 ? "bg-white" : "bg-slate-50/60"

            return (
              <Fragment key={p.llave_proceso}>
                <tr
                  className={`${zebra} ${rowTone} transition hover:bg-slate-100 cursor-pointer`}
                  onClick={() => setAbierto(abierto === p.llave_proceso ? null : p.llave_proceso)}
                >
                  <td className="px-6 py-4 align-top">
                    <div className="inline-flex flex-col gap-1">
                      <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.14em] text-slate-700">
                        {p.llave_proceso}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">Radicado principal</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{p.despacho || "Sin despacho"}</p>
                      <p className="text-xs text-slate-500">Despacho asignado</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {p.departamento || "Sin departamento"}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="max-w-[30rem] truncate font-medium text-slate-700">
                      {p.sujetos_procesales || "Sin sujetos procesales"}
                    </p>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">
                        {p.fecha_ultima_actuacion
                          ? new Date(p.fecha_ultima_actuacion).toLocaleDateString("es-CO")
                          : "Sin actualización"}
                      </p>
                      <p className="text-xs text-slate-500">Último cambio detectado</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    {p.notificado ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        Vigente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion"
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                        title="Abrir la consulta oficial de la Rama Judicial"
                      >
                        <span>Consulta oficial</span>
                        <span aria-hidden="true">↗</span>
                      </a>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenDetalle(p.llave_proceso)
                        }}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`}
                      >
                        <span>Ver detalle</span>
                        <span aria-hidden="true">↗</span>
                      </button>

                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          await navigator.clipboard.writeText(p.llave_proceso)
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        title="Copiar radicado"
                      >
                        <span>Copiar</span>
                        <span aria-hidden="true">⧉</span>
                      </button>

                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm(`¿Eliminar radicado ${p.llave_proceso}? Esta acción es irreversible.`)) return
                          try {
                            const res = await fetch(`http://localhost:8000/procesos/${p.llave_proceso}`, { method: "DELETE" })
                            if (!res.ok) {
                              const j = await res.json()
                              alert(j.detail || "Error al eliminar")
                              return
                            }
                            alert("Radicado eliminado")
                            if (onDelete) onDelete(p.llave_proceso)
                          } catch (e) {
                            alert("Error de red al eliminar")
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                        title="Eliminar radicado"
                      >
                        <span>Eliminar</span>
                        <span aria-hidden="true">✖</span>
                      </button>
                    </div>
                  </td>
                </tr>
                {abierto === p.llave_proceso && (
                  <tr className="bg-slate-100/40">
                    <td colSpan={7} className="px-4 pb-5 pt-0 sm:px-6">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Vista detallada</p>
                            <h4 className="mt-1 text-base font-semibold text-slate-900">{p.llave_proceso}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              {p.notificado ? "Monitoreado" : "En revisión"}
                            </div>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm(`¿Eliminar radicado ${p.llave_proceso}? Esta acción es irreversible.`)) return
                                try {
                                  const res = await fetch(`http://localhost:8000/procesos/${p.llave_proceso}`, { method: "DELETE" })
                                  if (!res.ok) {
                                    const j = await res.json()
                                    alert(j.detail || "Error al eliminar")
                                    return
                                  }
                                  alert("Radicado eliminado")
                                  if (onDelete) onDelete(p.llave_proceso)
                                } catch (err) {
                                  alert("Error de red al eliminar")
                                }
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">{p.tipo_proceso || "Sin dato"}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Clase</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">{p.clase_proceso || "Sin dato"}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Privado</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">{p.es_privado ? "Sí" : "No"}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fecha proceso</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">{p.fecha_proceso || "Sin dato"}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Creado</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">
                              {p.creado_en ? new Date(p.creado_en).toLocaleString("es-CO") : "Sin dato"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Actualizado</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">
                              {p.actualizado_en ? new Date(p.actualizado_en).toLocaleString("es-CO") : "Sin dato"}
                            </p>
                          </div>
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
  )
}
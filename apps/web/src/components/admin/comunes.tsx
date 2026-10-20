/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState, type ReactNode } from "react"
import toast from "react-hot-toast"
import { apiJson } from "../../api"
import Modal from "../Modal"

export const tarjeta = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
export const entrada = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
export const etiqueta = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-600"
export const botonPrimario = "min-h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
export const botonSecundario = "min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
export const botonPeligro = "min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
export const botonMini = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"

export const LIMITE = 25

export function fecha(valor?: string | null): string {
  if (!valor) return "—"
  const d = new Date(valor.endsWith("Z") || /[+-]\d\d:\d\d$/.test(valor) ? valor : `${valor}Z`) // el servidor guarda UTC sin zona
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
}

type Tono = "verde" | "ambar" | "rojo" | "gris" | "indigo"
const TONOS: Record<Tono, string> = {
  verde: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ambar: "border-amber-200 bg-amber-50 text-amber-700",
  rojo: "border-rose-200 bg-rose-50 text-rose-700",
  gris: "border-slate-200 bg-slate-50 text-slate-600",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
}

export function Insignia({ tono = "gris", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONOS[tono]}`}>{children}</span>
}

export function Paginador({ total, skip, limit = LIMITE, onCambio }: { total: number; skip: number; limit?: number; onCambio: (skip: number) => void }) {
  const pagina = Math.floor(skip / limit) + 1
  const paginas = Math.max(1, Math.ceil(total / limit))
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-xs text-slate-600">
      <span>{total} registro{total === 1 ? "" : "s"}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={botonMini} disabled={skip === 0} onClick={() => onCambio(Math.max(0, skip - limit))}>← Anterior</button>
        <span>Pág. {pagina} de {paginas}</span>
        <button type="button" className={botonMini} disabled={skip + limit >= total} onClick={() => onCambio(skip + limit)}>Siguiente →</button>
      </div>
    </div>
  )
}

export function Tabla({ columnas, children, vacio }: { columnas: string[]; children: ReactNode; vacio?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="bg-slate-100">
            {columnas.map((c) => <th key={c} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
      {vacio && <p className="px-4 py-8 text-center text-sm text-slate-500">{vacio}</p>}
    </div>
  )
}

/** Carga una lista del panel y la recarga cuando cambian los filtros o se llama a `recargar`. */
export function useLista<T>(ruta: string) {
  const [datos, setDatos] = useState<T | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    apiJson<T>(ruta)
      .then((d) => { if (vigente) { setDatos(d); setError("") } })
      .catch((e: Error) => { if (vigente) setError(e.message) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [ruta, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { datos, cargando, error, recargar }
}

/** Ejecuta una acción con aviso de éxito/error y recarga la lista al terminar. */
export async function accion(promesa: Promise<unknown>, exito: string, recargar?: () => void): Promise<boolean> {
  try {
    await promesa
    toast.success(exito)
    recargar?.()
    return true
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "No se pudo completar la acción")
    return false
  }
}

export function Confirmar({ titulo, mensaje, textoBoton = "Confirmar", onConfirmar, onCerrar }: { titulo: string; mensaje: ReactNode; textoBoton?: string; onConfirmar: () => void; onCerrar: () => void }) {
  return (
    <Modal titulo={titulo} role="alertdialog" onClose={onCerrar}>
      <div className="text-sm text-slate-600">{mensaje}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={botonPeligro} onClick={onConfirmar}>{textoBoton}</button>
        <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
      </div>
    </Modal>
  )
}

export function ErrorCarga({ mensaje }: { mensaje: string }) {
  return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{mensaje}</p>
}

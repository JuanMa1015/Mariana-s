import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { descargarDocumento } from "../api"

export default function BotonDocumento({ id, nombre }: { id: number; nombre: string }) {
  const [descargando, setDescargando] = useState(false)
  const enCurso = useRef(false)
  const descargar = async (evento: React.MouseEvent) => {
    evento.stopPropagation()
    if (enCurso.current) return
    enCurso.current = true
    setDescargando(true)
    const aviso = toast.loading("Descargando documento…")
    try {
      const resultado = await descargarDocumento(id, nombre)
      if (resultado === "cancelada") toast.dismiss(aviso)
      else toast.success(
        resultado === "descargas" ? "Documento guardado en Descargas."
          : resultado === "descargas-sin-aviso" ? "Guardado en Descargas. Para recibir el aviso, activa las notificaciones de Mariana’s en Ajustes de Android."
          : resultado === "opciones" ? "Usa las opciones del sistema para abrir o guardar el documento."
          : "Documento enviado a las descargas del navegador.",
        { id: aviso, duration: 6000 },
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el documento.", { id: aviso })
    } finally {
      enCurso.current = false
      setDescargando(false)
    }
  }
  return (
    <button type="button" onClick={(evento) => { void descargar(evento) }} disabled={descargando}
      aria-label={`Descargar ${nombre}`} aria-busy={descargando}
      className="min-h-11 shrink-0 rounded-lg border border-sky-300 bg-white px-3 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:opacity-60">
      {descargando ? "Descargando…" : "Descargar"}
    </button>
  )
}

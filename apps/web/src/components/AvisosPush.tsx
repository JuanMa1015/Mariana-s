import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { activarPush, escucharPush, pedirPermiso, permisoActual, pushDisponible, type EstadoPermiso } from "../push"

const SNOOZE_KEY = "mariana_push_snooze"
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000 // tras "Ahora no", no insistir durante una semana

const pospuesto = () => {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_MS
  } catch {
    return false
  }
}

/** App móvil: conecta los avisos push y pide el permiso con una explicación previa. */
export default function AvisosPush({ onAbrirProceso }: { onAbrirProceso: (llave: string) => void }) {
  const [permiso, setPermiso] = useState<EstadoPermiso | null>(null)
  const [oculto, setOculto] = useState(pospuesto)
  // En ref: el padre pasa una función nueva en cada render y no debe reconectar los eventos
  const abrirRef = useRef(onAbrirProceso)
  useEffect(() => { abrirRef.current = onAbrirProceso })

  useEffect(() => {
    if (!pushDisponible) return
    let desconectar: (() => void) | undefined
    let activo = true
    ;(async () => {
      const quitar = await escucharPush({ onAviso: (m) => toast(m, { icon: "🔔", duration: 6000 }), onAbrirProceso: (l) => abrirRef.current(l) })
      if (!activo) return quitar()
      desconectar = quitar
      const actual = await permisoActual()
      setPermiso(actual)
      if (actual === "granted") await activarPush()
    })().catch((e) => console.warn("Push no disponible", e))
    return () => {
      activo = false
      desconectar?.()
    }
  }, [])

  const activar = async () => {
    try {
      const nuevo = await pedirPermiso()
      setPermiso(nuevo)
      if (nuevo === "granted") {
        await activarPush()
        toast.success("Avisos activados")
      }
    } catch {
      toast.error("No se pudieron activar los avisos")
    }
  }

  const ahoraNo = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())) } catch { /* sin almacenamiento */ }
    setOculto(true)
  }

  if (!pushDisponible || oculto || !permiso || permiso === "granted") return null

  return (
    <div role="region" aria-label="Avisos en tu celular" className="no-print rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900 shadow-sm">
      {permiso === "prompt" ? (
        <>
          <p className="text-sm font-semibold">Activa los avisos en tu celular</p>
          <p className="mt-1 text-sm text-indigo-800">Te avisamos al instante cuando uno de tus procesos tenga actuaciones nuevas, aunque no tengas la app abierta.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={activar} className="min-h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95">Activar avisos</button>
            <button type="button" onClick={ahoraNo} className="min-h-10 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">Ahora no</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">Los avisos están bloqueados</p>
          <p className="mt-1 text-sm text-indigo-800">Para recibirlos, actívalos en Ajustes del celular → Aplicaciones → Mariana's → Notificaciones.</p>
          <button type="button" onClick={ahoraNo} className="mt-3 min-h-10 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">Entendido</button>
        </>
      )}
    </div>
  )
}

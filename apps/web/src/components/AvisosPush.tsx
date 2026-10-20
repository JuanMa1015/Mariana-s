import { useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { activarPush, escucharPush, permisoActual, pushDisponible } from "../push"

/**
 * App móvil, sin interfaz: mantiene conectados los avisos push en todas las pantallas privadas
 * (aviso con la app abierta, toque que abre el proceso y registro del celular en el servidor).
 */
export default function AvisosPush({ onAbrirProceso }: { onAbrirProceso: (llave: string) => void }) {
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
      if ((await permisoActual()) === "granted") await activarPush()
    })().catch((e) => console.warn("Push no disponible", e))
    return () => {
      activo = false
      desconectar?.()
    }
  }, [])

  return null
}

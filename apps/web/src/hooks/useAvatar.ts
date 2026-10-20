import { useEffect, useSyncExternalStore } from "react"
import { bajarAvatar } from "../api"

// Foto de perfil compartida por toda la app: se descarga una vez y se renueva al cambiarla.
// undefined = aún no cargada; null = el usuario no tiene foto.
let url: string | null | undefined
let cargando = false
const suscriptores = new Set<() => void>()

const publicar = (nueva: string | null) => {
  url = nueva
  suscriptores.forEach((f) => f())
}

export async function recargarAvatar(): Promise<void> {
  try {
    publicar(await bajarAvatar())
  } catch {
    publicar(null)
  }
}

export function limpiarAvatar(): void {
  publicar(null)
  url = undefined
}

export function useAvatar(): string | null {
  const actual = useSyncExternalStore(
    (cb) => {
      suscriptores.add(cb)
      return () => suscriptores.delete(cb)
    },
    () => url,
  )
  useEffect(() => {
    if (url === undefined && !cargando) {
      cargando = true
      void recargarAvatar().finally(() => { cargando = false })
    }
  }, [actual])
  return actual ?? null
}

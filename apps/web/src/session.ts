import { logoutUser } from "./api"
import { bajaPush } from "./push"
import { limpiarAvatar } from "./hooks/useAvatar"

/** Cierra la sesión en el servidor y borra los datos locales, conservando las preferencias del dispositivo. */
export async function cerrarSesion(): Promise<void> {
  await bajaPush() // antes de cerrar: requiere el token de acceso vigente
  try { await logoutUser() } catch { /* ignore */ }
  const tema = localStorage.getItem("mariana_tema")
  localStorage.clear()
  if (tema) localStorage.setItem("mariana_tema", tema)
  limpiarAvatar()
}

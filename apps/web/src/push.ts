import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { registrarDispositivo, bajaDispositivo } from "./api"

// Push solo en la app nativa y únicamente si el build incluye Firebase (google-services.json);
// sin él, registrar el dispositivo fallaría en el lado nativo.
export const pushDisponible = Capacitor.isNativePlatform() && import.meta.env.VITE_PUSH_ENABLED === "true"

const TOKEN_KEY = "mariana_push_token"
const CANAL = "novedades" // debe coincidir con CANAL_ANDROID del backend (services/push.py)

export type EstadoPermiso = "prompt" | "granted" | "denied"

const aEstado = (receive: string): EstadoPermiso =>
  receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt"

export async function permisoActual(): Promise<EstadoPermiso> {
  return aEstado((await PushNotifications.checkPermissions()).receive)
}

/** Muestra el diálogo del sistema (Android 13+). Solo se puede pedir una vez si el usuario rechaza. */
export async function pedirPermiso(): Promise<EstadoPermiso> {
  return aEstado((await PushNotifications.requestPermissions()).receive)
}

/** Crea el canal de Android y registra el dispositivo en FCM; el token llega por el evento "registration". */
export async function activarPush(): Promise<void> {
  try {
    await PushNotifications.createChannel({
      id: CANAL,
      name: "Novedades judiciales",
      description: "Avisos de nuevas actuaciones en tus procesos",
      importance: 4,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* iOS no tiene canales */
  }
  await PushNotifications.register()
}

interface Escuchas {
  onAviso: (mensaje: string) => void
  onAbrirProceso: (llave: string) => void
}

/** Conecta los eventos del plugin. Devuelve la función que los desconecta. */
export async function escucharPush({ onAviso, onAbrirProceso }: Escuchas): Promise<() => void> {
  const handles = await Promise.all([
    PushNotifications.addListener("registration", (t) => {
      localStorage.setItem(TOKEN_KEY, t.value)
      registrarDispositivo(t.value).catch(() => { /* se reintenta en el próximo arranque */ })
    }),
    PushNotifications.addListener("registrationError", (e) => console.warn("Push: registro fallido", e)),
    // Con la app abierta Android no muestra el aviso del sistema: se muestra dentro de la app
    PushNotifications.addListener("pushNotificationReceived", (n) => {
      onAviso([n.title, n.body].filter(Boolean).join(": "))
    }),
    // Al tocar el aviso (incluso con la app cerrada) se abre el proceso
    PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
      const llave = a.notification.data?.llave_proceso
      if (typeof llave === "string" && /^\d{23}$/.test(llave)) onAbrirProceso(llave)
    }),
  ])
  return () => handles.forEach((h) => void h.remove())
}

/** Cierre de sesión: este celular deja de recibir avisos de la cuenta. Llamar antes de cerrar sesión. */
export async function bajaPush(): Promise<void> {
  if (!pushDisponible) return
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) await bajaDispositivo(token).catch(() => { /* sin red: el backend limpia tokens inválidos */ })
  localStorage.removeItem(TOKEN_KEY)
  await PushNotifications.unregister().catch(() => undefined)
}

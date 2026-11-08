import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { registrarDispositivo, bajaDispositivo } from "./api"

// Push solo en la app nativa y únicamente si el build incluye Firebase (google-services.json);
// sin él, registrar el dispositivo fallaría en el lado nativo.
export const pushDisponible = Capacitor.isNativePlatform() && import.meta.env.VITE_PUSH_ENABLED === "true"

const TOKEN_KEY = "mariana_push_token"
const CANAL = "novedades" // debe coincidir con CANAL_ANDROID del backend (services/push.py)

export type EstadoPermiso = "prompt" | "granted" | "denied"
export type EstadoRegistroPush = "pendiente" | "registrando" | "registrado" | "error"

let estadoRegistro: EstadoRegistroPush = "pendiente"
let esperaRegistro: ReturnType<typeof setTimeout> | undefined
const suscriptoresRegistro = new Set<() => void>()

export const estadoRegistroPush = () => estadoRegistro

export function suscribirRegistroPush(avisar: () => void) {
  suscriptoresRegistro.add(avisar)
  return () => { suscriptoresRegistro.delete(avisar) }
}

function actualizarRegistro(estado: EstadoRegistroPush) {
  clearTimeout(esperaRegistro)
  estadoRegistro = estado
  suscriptoresRegistro.forEach((avisar) => avisar())
}

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
  if (estadoRegistro === "registrando") return
  actualizarRegistro("registrando")
  esperaRegistro = setTimeout(() => actualizarRegistro("error"), 15000)
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
  try {
    await PushNotifications.register()
  } catch (error) {
    actualizarRegistro("error")
    throw error
  }
}

interface Escuchas {
  onAviso: (mensaje: string) => void
  onAbrirProceso: (llave: string) => void
}

/** Conecta los eventos del plugin. Devuelve la función que los desconecta. */
export async function escucharPush({ onAviso, onAbrirProceso }: Escuchas): Promise<() => void> {
  let activo = true
  let ultimoRegistro = 0
  const handles = await Promise.all([
    PushNotifications.addListener("registration", (t) => {
      if (!activo) return
      const intento = ++ultimoRegistro
      actualizarRegistro("registrando")
      localStorage.setItem(TOKEN_KEY, t.value)
      void registrarDispositivo(t.value).then((resultado) => {
        if (activo && intento === ultimoRegistro) actualizarRegistro(resultado.registered === true ? "registrado" : "error")
      }).catch(() => {
        if (activo && intento === ultimoRegistro) actualizarRegistro("error")
      })
    }),
    PushNotifications.addListener("registrationError", () => {
      if (activo) {
        ultimoRegistro += 1
        actualizarRegistro("error")
      }
    }),
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
  return () => {
    activo = false
    actualizarRegistro("pendiente")
    handles.forEach((h) => void h.remove())
  }
}

/** Cierre de sesión: este celular deja de recibir avisos de la cuenta. Llamar antes de cerrar sesión. */
export async function bajaPush(): Promise<void> {
  if (!pushDisponible) return
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) await bajaDispositivo(token).catch(() => { /* sin red: el backend limpia tokens inválidos */ })
  localStorage.removeItem(TOKEN_KEY)
  await PushNotifications.unregister().catch(() => undefined)
}

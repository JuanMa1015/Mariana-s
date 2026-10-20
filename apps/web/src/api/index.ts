import { Capacitor } from "@capacitor/core"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

// App movil: las cookies cross-site no son fiables en el WebView, asi que se usa Bearer.
// ponytail: token en localStorage; migrar a almacenamiento seguro (Keychain/Keystore) si se endurece.
const nativa = Capacitor.isNativePlatform()
const TOKEN_KEY = "mariana_token"
const guardarToken = (data: { access_token?: string }) => {
  if (nativa && data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token)
}

function _esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fetchBase(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {})
  if (nativa) {
    headers.set("X-Client", "native")
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) headers.set("Authorization", `Bearer ${token}`)
  }
  const merged: RequestInit = { ...options, credentials: "include", headers }
  return fetch(url, merged)
}

async function fetchWithAuth(url: string, options: RequestInit = {}, reintentos = 3) {
  for (let intento = 0; intento < reintentos; intento++) {
    let res: Response
    try {
      res = await fetchBase(url, options)
    } catch (err) {
      if (intento < reintentos - 1) {
        const espera = 1000 * 2 ** intento
        console.warn(`fetch falló (red), reintento ${intento + 1}/${reintentos} en ${espera}ms:`, err)
        await _esperar(espera)
        continue
      }
      throw new Error("Error de conexión. Revisa tu internet.", { cause: err })
    }

    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = "/login"
      throw new Error("Unauthorized")
    }

    if (res.status >= 500 && res.status < 600 && intento < reintentos - 1) {
      const espera = 1000 * 2 ** intento
      console.warn(`API respondió ${res.status}, reintento ${intento + 1}/${reintentos} en ${espera}ms`)
      await _esperar(espera)
      continue
    }

    return res
  }

  throw new Error(`Error de conexión después de ${reintentos} intentos`)
}

export async function loginUser(payload: { credential: string; password: string }) {
  let res: Response
  try {
    res = await fetchBase(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  } catch {
    throw new Error("Error de conexión. Revisa tu internet.")
  }
  if (!res.ok) throw new Error((await res.json()).detail || "Error en login")
  const data = await res.json()
  guardarToken(data)
  return data
}

export async function registerUser(payload: { email: string; password: string; username?: string }) {
  let res: Response
  try {
    res = await fetchBase(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  } catch {
    throw new Error("Error de conexión. Revisa tu internet.")
  }
  if (!res.ok) throw new Error((await res.json()).detail || "Error en registro")
  const data = await res.json()
  guardarToken(data)
  return data
}

/** Registra el token push de este celular para el usuario autenticado. */
export async function registrarDispositivo(token: string) {
  const res = await fetchWithAuth(`${BASE_URL}/dispositivos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, plataforma: Capacitor.getPlatform() === "ios" ? "ios" : "android" }),
  })
  return res.json()
}

/** Pide al servidor un aviso push de ejemplo (simula una novedad); `demora` da tiempo de cerrar la app. */
export async function enviarAvisoDePrueba(demora = 0): Promise<{ enviados: number; programado_en?: number }> {
  const res = await fetchWithAuth(`${BASE_URL}/dispositivos/prueba?demora=${demora}`, { method: "POST" })
  if (!res.ok) throw new Error((await res.json()).detail || "No se pudo enviar el aviso de prueba")
  return res.json()
}

/** Deja de enviar push a este celular (se llama antes de cerrar sesión). */
export async function bajaDispositivo(token: string) {
  const res = await fetchWithAuth(`${BASE_URL}/dispositivos/baja`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  return res.json()
}

async function detalleError(res: Response, porDefecto: string): Promise<string> {
  try {
    const detail = (await res.json()).detail
    if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") || porDefecto
    return typeof detail === "string" && detail ? detail : porDefecto
  } catch {
    return porDefecto
  }
}

/** Llamada JSON autenticada genérica (la usa el panel de administración). Lanza Error con el detalle del servidor. */
export async function apiJson<T>(ruta: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = opciones
  const res = await fetchWithAuth(`${BASE_URL}${ruta}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await detalleError(res, `Error ${res.status}`))
  return res.json()
}

/** Foto de perfil como data URL (null si el usuario no tiene). */
export async function bajarAvatar(): Promise<string | null> {
  const res = await fetchWithAuth(`${BASE_URL}/cuenta/avatar`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await detalleError(res, "No se pudo cargar la foto"))
  return (await res.json()).data_url
}

export async function subirAvatar(imagen: Blob): Promise<void> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result).split(",")[1] ?? "")
    lector.onerror = () => reject(new Error("No se pudo leer la imagen"))
    lector.readAsDataURL(imagen)
  })
  const res = await fetchWithAuth(`${BASE_URL}/cuenta/avatar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagen: base64 }),
  })
  if (!res.ok) throw new Error(await detalleError(res, "No se pudo guardar la foto"))
}

export async function borrarAvatar(): Promise<void> {
  const res = await fetchWithAuth(`${BASE_URL}/cuenta/avatar`, { method: "DELETE" })
  if (!res.ok) throw new Error(await detalleError(res, "No se pudo quitar la foto"))
}

export async function cambiarUsuario(username: string, password: string): Promise<{ username: string }> {
  const res = await fetchWithAuth(`${BASE_URL}/cuenta/usuario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(await detalleError(res, "No se pudo cambiar el usuario"))
  return res.json()
}

/** Envía al correo de la cuenta el enlace para elegir una nueva contraseña. */
export async function solicitarCambioPassword(): Promise<{ email: string }> {
  const res = await fetchWithAuth(`${BASE_URL}/cuenta/password/solicitar`, { method: "POST" })
  if (!res.ok) throw new Error(await detalleError(res, "No se pudo enviar el correo"))
  return res.json()
}

export async function olvidePassword(email: string): Promise<void> {
  let res: Response
  try {
    res = await fetchBase(`${BASE_URL}/auth/password/olvide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  } catch {
    throw new Error("Error de conexión. Revisa tu internet.")
  }
  if (!res.ok) throw new Error(await detalleError(res, "No se pudo enviar el correo"))
}

export async function restablecerPassword(token: string, password: string): Promise<void> {
  let res: Response
  try {
    res = await fetchBase(`${BASE_URL}/auth/password/restablecer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
  } catch {
    throw new Error("Error de conexión. Revisa tu internet.")
  }
  if (!res.ok) throw new Error(await detalleError(res, "No se pudo cambiar la contraseña"))
}

export async function getMe() {
  const res = await fetchWithAuth(`${BASE_URL}/auth/me`)
  return res.json()
}

export async function logoutUser() {
  const res = await fetchWithAuth(`${BASE_URL}/auth/logout`, { method: "POST" })
  localStorage.removeItem(TOKEN_KEY)
  return res.json()
}

export async function getProcesos(despacho?: string, departamento?: string, skip = 0, limit = 10, categoria?: string, q?: string, orden?: string) {
  const params = new URLSearchParams()
  if (despacho) params.append("despacho", despacho)
  if (departamento) params.append("departamento", departamento)
  if (categoria) params.append("categoria", categoria)
  if (q) params.append("q", q)
  if (orden) params.append("orden", orden)
  params.append("skip", String(skip))
  params.append("limit", String(limit))
  const res = await fetchWithAuth(`${BASE_URL}/procesos/?${params}`)
  return res.json()
}

export async function getProceso(llaveProceso: string, skip?: number, limit?: number) {
  const params = new URLSearchParams()
  if (skip !== undefined) params.append("skip", String(skip))
  if (limit !== undefined) params.append("limit", String(limit))
  const qs = params.toString()
  const res = await fetchWithAuth(`${BASE_URL}/procesos/${llaveProceso}${qs ? `?${qs}` : ""}`)
  if (!res.ok) throw new Error((await res.json()).detail || "Error fetching")
  return res.json()
}

export async function getNovedades() {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/novedades`)
  return res.json()
}

export async function postSync() {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/sync`, { method: "POST" })
  return res.json()
}

export async function getSyncEstado() {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/sync/estado`)
  return res.json()
}

export async function postAddRadicado(payload: { llave_proceso: string; despacho?: string; departamento?: string; sujetos_procesales?: string; categoria?: string }) {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return { created: false, detail: (await res.json()).detail || "Failed to add" }
  return res.json()
}

export async function deleteProceso(llaveProceso: string) {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/${llaveProceso}`, { method: "DELETE" })
  if (!res.ok) throw new Error((await res.json()).detail || "Delete failed")
  return res.json()
}

export async function getNovedadesDetalle(skip = 0, limit = 50) {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/novedades-detalle?skip=${skip}&limit=${limit}`)
  return res.json()
}

export async function updateProceso(llaveProceso: string, payload: Partial<{ llave_proceso: string; despacho: string; departamento: string; sujetos_procesales: string; categoria: string; alias: string; notificado: boolean; fecha_ultima_actuacion: string }>) {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/${llaveProceso}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json()).detail || "Update failed")
  return res.json()
}

export async function marcarTodoLeido() {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/marcar-todo-leido`, { method: "POST" })
  return res.json()
}

export async function descargarDocumento(id: number, nombre: string) {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/documento/${id}`)
  if (!res.ok) throw new Error("No se pudo descargar el documento")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
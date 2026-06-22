const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

function _esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithAuth(url: string, options: RequestInit = {}, reintentos = 3) {
  const token = localStorage.getItem("token")
  const headers = new Headers(options.headers || {})
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  for (let intento = 0; intento < reintentos; intento++) {
    let res: Response
    try {
      res = await fetch(url, { ...options, headers })
    } catch (err) {
      if (intento < reintentos - 1) {
        const espera = 1000 * 2 ** intento
        console.warn(`fetch falló (red), reintento ${intento + 1}/${reintentos} en ${espera}ms:`, err)
        await _esperar(espera)
        continue
      }
      throw new Error("Error de conexión. Revisa tu internet.")
    }

    if (res.status === 401) {
      localStorage.removeItem("token")
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
    res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  } catch {
    throw new Error("Error de conexión. Revisa tu internet.")
  }
  if (!res.ok) throw new Error((await res.json()).detail || "Error en login")
  return res.json()
}

export async function registerUser(payload: { email: string; password: string; username?: string }) {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  } catch {
    throw new Error("Error de conexión. Revisa tu internet.")
  }
  if (!res.ok) throw new Error((await res.json()).detail || "Error en registro")
  return res.json()
}

export async function getProcesos(despacho?: string, departamento?: string, skip = 0, limit = 10, categoria?: string, q?: string) {
  const params = new URLSearchParams()
  if (despacho) params.append("despacho", despacho)
  if (departamento) params.append("departamento", departamento)
  if (categoria) params.append("categoria", categoria)
  if (q) params.append("q", q)
  params.append("skip", String(skip))
  params.append("limit", String(limit))
  const res = await fetchWithAuth(`${BASE_URL}/procesos/?${params}`)
  return res.json()
}

export async function getProceso(llaveProceso: string) {
  const res = await fetchWithAuth(`${BASE_URL}/procesos/${llaveProceso}`)
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

export async function updateProceso(llaveProceso: string, payload: Partial<{ llave_proceso: string; despacho: string; departamento: string; sujetos_procesales: string; categoria: string; notificado: boolean; fecha_ultima_actuacion: string }>) {
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
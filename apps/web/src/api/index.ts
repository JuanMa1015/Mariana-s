const BASE_URL = "http://localhost:8000"

export async function getProcesos(despacho?: string, departamento?: string, skip = 0, limit = 10) {
  const params = new URLSearchParams()
  if (despacho) params.append("despacho", despacho)
  if (departamento) params.append("departamento", departamento)
  params.append("skip", String(skip))
  params.append("limit", String(limit))
  const res = await fetch(`${BASE_URL}/procesos/?${params}`)
  return res.json()
}

export async function getProceso(llaveProceso: string) {
  const res = await fetch(`${BASE_URL}/procesos/${llaveProceso}`)
  return res.json()
}

export async function getNovedades() {
  const res = await fetch(`${BASE_URL}/procesos/novedades`)
  return res.json()
}

export async function postSync() {
  const res = await fetch(`${BASE_URL}/procesos/sync`, { method: "POST" })
  return res.json()
}

export async function postAddRadicado(payload: { llave_proceso: string; despacho?: string; departamento?: string; sujetos_procesales?: string }) {
  const res = await fetch(`${BASE_URL}/procesos/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function deleteProceso(llaveProceso: string) {
  const res = await fetch(`${BASE_URL}/procesos/${llaveProceso}`, { method: "DELETE" })
  if (!res.ok) throw new Error((await res.json()).detail || "Delete failed")
  return res.json()
}

export async function updateProceso(llaveProceso: string, payload: Partial<{ despacho: string; departamento: string; sujetos_procesales: string; notificado: boolean; fecha_ultima_actuacion: string }>) {
  const res = await fetch(`${BASE_URL}/procesos/${llaveProceso}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json()).detail || "Update failed")
  return res.json()
}
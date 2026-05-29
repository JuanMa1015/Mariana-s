const BASE_URL = "http://localhost:8000"

export async function getProcesos(despacho?: string, departamento?: string) {
  const params = new URLSearchParams()
  if (despacho) params.append("despacho", despacho)
  if (departamento) params.append("departamento", departamento)
  const res = await fetch(`${BASE_URL}/procesos/?${params}`)
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
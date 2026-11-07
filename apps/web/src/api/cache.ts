// Los expedientes solo se conservan durante esta sesión de la aplicación.
const entradas = new Map<string, { data: unknown; ts: number }>()
const TTL = 5 * 60 * 1000
const MAX_ENTRADAS = 60
let cuenta: string | null = null

export function clearCache(): void {
  entradas.clear()
  // Retira los datos que dejaron las versiones anteriores.
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("mc_")) localStorage.removeItem(key)
    }
  } catch { /* La caché en memoria se limpia aunque el navegador bloquee el almacenamiento. */ }
}

export function setCacheUser(email: string): void {
  if (cuenta !== email) {
    clearCache()
    cuenta = email
  }
}

export function getCache<T>(key: string): T | null {
  const entrada = entradas.get(key)
  if (!entrada) return null
  if (Date.now() - entrada.ts > TTL) {
    entradas.delete(key)
    return null
  }
  return entrada.data as T
}

export function setCache(key: string, data: unknown): void {
  entradas.delete(key)
  entradas.set(key, { data, ts: Date.now() })
  if (entradas.size > MAX_ENTRADAS) entradas.delete(entradas.keys().next().value!)
}

export function removeCache(key: string): void {
  entradas.delete(key)
}

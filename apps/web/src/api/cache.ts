const PREFIX = "mc_"
const TTL = 5 * 60 * 1000

export function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > TTL) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return data as T
  } catch {
    return null
  }
}

export function setCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    /* quota exceeded */
  }
}

export function removeCache(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

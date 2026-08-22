const PREFIX = "mc_"
const TTL = 5 * 60 * 1000
// Maximo de entradas con prefijo mc_ en localStorage: evita crecimiento
// ilimitado (cada busqueda/pagina crea una llave distinta).
const MAX_ENTRADAS = 60

function clavesPropias(): string[] {
  const claves: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) claves.push(k)
  }
  return claves
}

function desalojarAntiguas(): void {
  const claves = clavesPropias()
  if (claves.length <= MAX_ENTRADAS) return
  const porTiempo = claves
    .map((k) => {
      try {
        const { ts } = JSON.parse(localStorage.getItem(k) || "{}")
        return { k, ts: typeof ts === "number" ? ts : 0 }
      } catch {
        return { k, ts: 0 }
      }
    })
    .sort((a, b) => a.ts - b.ts)
  for (const { k } of porTiempo.slice(0, claves.length - MAX_ENTRADAS)) {
    localStorage.removeItem(k)
  }
}

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
    desalojarAntiguas()
  } catch {
    /* quota exceeded: se limpian las mas viejas y se reintenta una vez */
    try {
      const claves = clavesPropias()
      for (const k of claves) if (k !== PREFIX + key) localStorage.removeItem(k)
      localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
    } catch {
      /* nada que hacer sin cuota */
    }
  }
}

export function removeCache(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

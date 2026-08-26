import { useEffect } from "react"

const TITULO_BASE = "Mariana's — Monitor Judicial de Procesos"

export function useTitle(titulo?: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Mariana's` : TITULO_BASE
    return () => {
      document.title = TITULO_BASE
    }
  }, [titulo])
}

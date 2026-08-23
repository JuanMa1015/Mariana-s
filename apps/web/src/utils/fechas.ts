// Formato canonico de fecha corta para toda la app: "15 jun 2026".
// Acepta ISO con o sin hora; devuelve null si no hay valor y el texto
// original si la fecha es invalida.
export function formatearFechaCorta(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })
}

/** Agrupa un radicado de 23 dígitos para leerlo mejor: 05001 31 03 017 2024 00480 00 */
export function formatearRadicado(llave: string): string {
  return llave.replace(/^(\d{5})(\d{2})(\d{2})(\d{3})(\d{4})(\d{5})(\d{2})$/, "$1 $2 $3 $4 $5 $6 $7")
}

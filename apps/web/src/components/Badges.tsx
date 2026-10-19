const CATEGORIAS: Record<string, { caja: string; punto: string }> = {
  Trabajo: { caja: "border-sky-200 bg-sky-50 text-sky-700", punto: "bg-sky-500" },
  Consultorio: { caja: "border-amber-200 bg-amber-50 text-amber-700", punto: "bg-amber-500" },
  General: { caja: "border-indigo-200 bg-indigo-50 text-indigo-700", punto: "bg-indigo-500" },
}

export function CategoriaBadge({ categoria }: { categoria?: string | null }) {
  if (!categoria) return <span className="text-xs italic text-slate-500">—</span>
  const c = CATEGORIAS[categoria] ?? CATEGORIAS.General
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${c.caja}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.punto}`} />
      {categoria}
    </span>
  )
}

/** "Con novedad" = hay actuaciones nuevas sin revisar; "Al día" = ya revisado. */
export function EstadoBadge({ notificado }: { notificado: boolean }) {
  const e = notificado
    ? { caja: "border-emerald-200 bg-emerald-50 text-emerald-700", punto: "bg-emerald-500", label: "Al día" }
    : { caja: "border-amber-200 bg-amber-50 text-amber-700", punto: "bg-amber-500", label: "Con novedad" }
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${e.caja}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${e.punto}`} />
      {e.label}
    </span>
  )
}

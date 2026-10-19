interface Props {
  enDetalle: boolean
  syncing: boolean
  onProcesos: () => void
  onNovedades: () => void
  onSync: () => void
  onSalir: () => void
}

/** Navegación inferior (solo móvil): acciones al alcance del pulgar. */
export default function BottomNav({ enDetalle, syncing, onProcesos, onNovedades, onSync, onSalir }: Props) {
  const items = [
          { label: "Procesos", icon: "M4 6h16M4 12h16M4 18h16", onClick: onProcesos, activo: !enDetalle },
          { label: "Novedades", icon: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3C7.7 6.2 6 8.4 6 11v3.2c0 .5-.2 1.1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", onClick: onNovedades },
          { label: syncing ? "Actualizando" : "Actualizar", icon: "M16 9.3h5V4.4M3 19.6v-5h5m-5 0l3.2 3.2a8.3 8.3 0 0013.8-3.7M4 9.9a8.3 8.3 0 0113.8-3.7L21 9.3", onClick: onSync, deshabilitado: syncing },
          { label: "Oficial", icon: "M13.5 6H18v4.5M18 6l-7.5 7.5M10 6H6.5A1.5 1.5 0 005 7.5v10A1.5 1.5 0 006.5 19h10a1.5 1.5 0 001.5-1.5V14", onClick: () => window.open("https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion", "_blank", "noopener") },
          { label: "Salir", icon: "M15 12H4m0 0l3-3m-3 3l3 3m5-8V6a2 2 0 012-2h5a2 2 0 012 2v12a2 2 0 01-2 2h-5a2 2 0 01-2-2v-2", onClick: onSalir },
        ]
  return (
    <nav
      aria-label="Navegación principal"
      className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-indigo-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          disabled={it.deshabilitado}
          aria-current={it.activo ? "page" : undefined}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition active:bg-indigo-50 disabled:opacity-50 ${it.activo ? "text-indigo-700" : "text-slate-500"}`}
        >
          <svg className={`h-5 w-5 ${it.deshabilitado ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={it.icon} />
          </svg>
          {it.label}
        </button>
      ))}
    </nav>
  )
}

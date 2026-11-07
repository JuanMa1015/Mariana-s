import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"

/** Destinos estables en todas las pantallas privadas, incluido el expediente. */
export default function BottomNav() {
  const location = useLocation()
  const [ultimaLista, setUltimaLista] = useState("/procesos")
  const destinoLista = location.pathname.startsWith("/procesos") ? `/procesos${location.search}` : ultimaLista
  if (destinoLista !== ultimaLista) setUltimaLista(destinoLista)
  return (
    <nav aria-label="Navegación principal" className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-indigo-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      {[
        { to: destinoLista, label: "Procesos", icon: "M4 6h16M4 12h16M4 18h16" },
        { to: "/novedades", label: "Novedades", icon: "M12 3a6 6 0 00-6 6v5l-2 3h16l-2-3V9a6 6 0 00-6-6M9 20h6" },
        { to: "/ajustes", label: "Ajustes", icon: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M8 15v6" },
      ].map(({ to, label, icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600"}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

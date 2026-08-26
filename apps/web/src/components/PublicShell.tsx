import { useState } from "react"
import { Link } from "react-router-dom"
import { CONTACT_EMAIL, NOMBRE_APP, RESPONSABLE, UBICACION } from "../site"

function LogoBolt({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2 4.5 13.5c-.4.55 0 1.5.9 1.5H11l-1.8 6.7c-.15.75.75 1.2 1.25.6L19.5 10.3c.45-.55.05-1.55-.85-1.55H13l1.6-6.1C14.75 1.9 13.6 1.35 13 2Z" />
    </svg>
  )
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label={`${NOMBRE_APP}, inicio`}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-white"><LogoBolt /></span>
            <span className="text-lg font-bold tracking-tight">{NOMBRE_APP}</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Principal">
            <Link to="/privacidad" className="hidden text-sm text-slate-600 hover:text-slate-900 sm:block">Privacidad</Link>
            <Link to="/terminos" className="hidden text-sm text-slate-600 hover:text-slate-900 sm:block">Términos</Link>
            <Link to="/login" className="rounded-full px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-50">Entrar</Link>
            <Link to="/register" className="rounded-full bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-700">Crear cuenta</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-bold"><span className="grid h-6 w-6 place-items-center rounded-md bg-violet-600 text-white"><LogoBolt className="h-4 w-4" /></span>{NOMBRE_APP}</p>
            <p className="mt-2 text-sm text-slate-600">Monitoreo automático de procesos judiciales para abogados y despachos.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Legal</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li><Link to="/privacidad" className="hover:text-violet-700">Política de Privacidad</Link></li>
              <li><Link to="/terminos" className="hover:text-violet-700">Términos y Condiciones</Link></li>
              <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-violet-700">{CONTACT_EMAIL}</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Contacto</p>
            <p className="mt-2 text-sm text-slate-600">{RESPONSABLE}<br />{UBICACION}</p>
          </div>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {NOMBRE_APP} · Todos los derechos reservados
        </div>
      </footer>
    </div>
  )
}

export function CookieBanner() {
  // El aviso se muestra hasta que el usuario lo cierra (preferencia persistida)
  const [visible, setVisible] = useState(() => !localStorage.getItem("cookiesAvisoVisto"))

  const cerrar = () => {
    localStorage.setItem("cookiesAvisoVisto", "1")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div role="region" aria-label="Aviso sobre cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:left-auto sm:w-[26rem]">
      <p className="text-sm text-slate-700">
        <strong>{NOMBRE_APP}</strong> no usa cookies de seguimiento ni publicidad. Solo guardamos lo técnico necesario para tu sesión y preferencias.
        {" "}Más detalles en la <Link to="/privacidad" className="font-semibold text-violet-700 hover:underline">Política de Privacidad</Link>.
      </p>
      <button onClick={cerrar} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 sm:w-auto">
        Entendido
      </button>
    </div>
  )
}

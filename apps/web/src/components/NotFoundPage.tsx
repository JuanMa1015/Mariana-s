import { Link } from "react-router-dom"
import { useTitle } from "../hooks/useTitle"
import { CookieBanner, PublicShell } from "./PublicShell"

export default function NotFoundPage() {
  useTitle("Página no encontrada")

  return (
    <PublicShell>
      <CookieBanner />
      <section className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <p className="text-[6rem] font-black leading-none tracking-tight text-violet-600/20 sm:text-[8rem]">404</p>
        <h1 className="-mt-6 text-2xl font-bold text-slate-900">Esta página no existe</h1>
        <p className="mt-3 text-slate-600">
          La dirección que buscaste no se encontró o cambió de lugar. Tranquilo: tus procesos siguen donde siempre.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/procesos" className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700">
            Ir a mis procesos
          </Link>
          <Link to="/" className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Volver al inicio
          </Link>
        </div>
      </section>
    </PublicShell>
  )
}

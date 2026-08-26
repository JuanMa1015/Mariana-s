import { Link, useSearchParams } from "react-router-dom"
import { useTitle } from "../hooks/useTitle"
import { CONTACT_EMAIL } from "../site"
import { PublicShell } from "./PublicShell"

export default function ThanksPage() {
  useTitle("¡Gracias!")
  const [params] = useSearchParams()
  const esNuevo = params.get("nuevo") === "1"

  return (
    <PublicShell>
      <section className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-8 w-8 text-emerald-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>

        {esNuevo ? (
          <>
            <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">¡Tu cuenta está lista!</h1>
            <p className="mt-3 text-slate-600">
              Ya puedes agregar tu primer radicado de 23 dígitos y dejar que Mariana's vigile por ti.
              Las próximas novedades te llegarán automáticamente.
            </p>
            <Link to="/procesos" className="mt-8 rounded-2xl bg-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 active:scale-95">
              Entrar a mis procesos
            </Link>
            <p className="mt-4 text-xs text-slate-500">
              ¿Dudas? Escríbenos a{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-violet-700 hover:underline">{CONTACT_EMAIL}</a>
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">¡Gracias por tu mensaje!</h1>
            <p className="mt-3 text-slate-600">
              Lo recibimos correctamente y te responderemos a la mayor brevedad al correo que nos indicaste.
            </p>
            <Link to="/" className="mt-8 rounded-2xl bg-violet-600 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700">
              Volver al inicio
            </Link>
          </>
        )}
      </section>
    </PublicShell>
  )
}

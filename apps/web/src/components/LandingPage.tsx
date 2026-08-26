import { Link } from "react-router-dom"
import { useTitle } from "../hooks/useTitle"
import { CONTACT_EMAIL, NOMBRE_APP, UBICACION } from "../site"
import { CookieBanner, PublicShell } from "./PublicShell"

function Bolt({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2 4.5 13.5c-.4.55 0 1.5.9 1.5H11l-1.8 6.7c-.15.75.75 1.2 1.25.6L19.5 10.3c.45-.55.05-1.55-.85-1.55H13l1.6-6.1C14.75 1.9 13.6 1.35 13 2Z" />
    </svg>
  )
}

const FEATURES = [
  {
    titulo: "Monitoreo automático cada hora",
    desc: "Revisamos la Rama Judicial por ti, radicado por radicado. Tú no vuelves a entrar a consultas lentas ni a refrescar pantallas.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    titulo: "Alertas por correo y Telegram",
    desc: "Cuando aparece una actuación nueva recibes el aviso al instante en tus canales, con fechas, anotación y documentos.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    ),
  },
  {
    titulo: "Historial completo de actuaciones",
    desc: "Cada proceso guarda su línea de tiempo con fechas, anotaciones y conteo de documentos, lista para consultar o imprimir.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    ),
  },
  {
    titulo: "Descarga de documentos",
    desc: "Accede directo a los PDF publicados con cada actuación, sin buscarlos manualmente en el portal oficial.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3V15" />
    ),
  },
  {
    titulo: "Organizado por despacho",
    desc: "Separa tus procesos por categoría (trabajo, consultorio, general), filtra y busca por radicado, parte o juzgado en segundos.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    ),
  },
  {
    titulo: "Privado y seguro",
    desc: "Tus procesos solo los ves tú: contraseñas cifradas con bcrypt, sesión por cookie segura y límites anti-abuso.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    ),
  },
]

function MockFila({ radicado, badge, badgeColor, juzgado, fecha }: { radicado: string; badge: string; badgeColor: string; juzgado: string; fecha: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-600"><Bolt className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-800">{radicado}</p>
        <p className="truncate text-[11px] text-slate-500">{juzgado}</p>
      </div>
      <div className="text-right">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>{badge}</span>
        <p className="mt-0.5 text-[10px] text-slate-400">{fecha}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  useTitle("Monitor Judicial de Procesos — alertas automáticas para abogados")

  return (
    <PublicShell>
      <CookieBanner />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-white to-white">
        <div className="pointer-events-none absolute -top-24 right-[-6rem] h-72 w-72 rounded-full bg-violet-200/50 blur-3xl" aria-hidden="true" />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              Para abogados, consultorios y despachos
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Tus procesos judiciales, <span className="text-violet-600">vigilados 24/7</span> sin abrir la Rama Judicial
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Mariana's revisa por ti cada radicado que sigues y te avisa por correo y Telegram en cuanto hay una actuación nueva.
              Deja de perder novedades y deja de revisar manualmente.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 active:scale-95">
                Crear cuenta gratis
              </Link>
              <Link to="#como-funciona" className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Ver cómo funciona
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">Configuración en 2 minutos · Sin tarjeta · Cancela cuando quieras</p>
          </div>

          {/* Mock del producto (CSS puro, sin imágenes) */}
          <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
            <div className="absolute -inset-4 rounded-3xl bg-violet-600/10 blur-2xl" />
            <div className="relative rotate-1 rounded-3xl border border-violet-100 bg-violet-50/80 p-4 shadow-xl shadow-violet-600/10 backdrop-blur transition hover:rotate-0">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-xs font-bold uppercase tracking-widest text-violet-500">Novedades hoy</p>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">En vivo</span>
              </div>
              <div className="space-y-2">
                <MockFila radicado="08001…2600008100" badge="Nueva actuación" badgeColor="bg-amber-100 text-amber-800" juzgado="Juzgado 001 Administrativo Oral" fecha="hace 12 min" />
                <MockFila radicado="05001…26000106500" badge="Notificada" badgeColor="bg-emerald-100 text-emerald-700" juzgado="Juzgado 105 Civil de Circuito" fecha="hace 1 h" />
                <MockFila radicado="25002…1600134500" badge="Nueva actuación" badgeColor="bg-amber-100 text-amber-800" juzgado="Juzgado 337 Laboral" fecha="hace 2 h" />
                <MockFila radicado="13001…2200061600" badge="Notificada" badgeColor="bg-emerald-100 text-emerald-700" juzgado="Juzgado 123 Penal del Ciruito" fecha="ayer" />
              </div>
              <p className="mt-3 px-1 text-[11px] text-slate-400">Correo y Telegram enviados automáticamente ✓</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Funciones ── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="titulo-funciones">
        <h2 id="titulo-funciones" className="text-center text-3xl font-black tracking-tight text-slate-900">Todo lo que un despacho necesita para no perder una novedad</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.titulo} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" aria-hidden="true">{f.icono}</svg>
              </span>
              <h3 className="mt-4 font-bold text-slate-900">{f.titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section id="como-funciona" className="border-y border-slate-100 bg-slate-50 py-16 scroll-mt-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight text-slate-900">Cómo funciona</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["Crea tu cuenta", "Regístrate con tu correo en menos de dos minutos."],
              ["Agrega tus radicados", "Pega el número de 23 dígitos y organiza cada proceso por categoría."],
              ["Recibe las alertas", "Mariana's vigila cada hora y te avisa ante cualquier actuación nueva."],
            ].map(([t, d], i) => (
              <li key={t} className="relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-sm font-black text-white">{i + 1}</span>
                <h3 className="mt-3 font-bold text-slate-900">{t}</h3>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-3xl font-black tracking-tight text-slate-900">Empieza a monitorear hoy mismo</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">Agrega tu primer radicado en minutos y relájate: las próximas novedades te llegan solas.</p>
        <Link to="/register" className="mt-8 inline-flex items-center justify-center rounded-2xl bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 active:scale-95">
          Crear mi cuenta gratis
        </Link>
        <p className="mt-6 text-sm text-slate-500">
          ¿Preguntas? Escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-violet-700 hover:underline">{CONTACT_EMAIL}</a>
        </p>
      </section>

      {/* ── Quién hay detrás ── */}
      <section className="border-t border-slate-100 bg-slate-50 py-10">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-sm text-slate-600">
            <strong>{NOMBRE_APP}</strong> es una organización con presencia en {UBICACION}.
            Comprometidos con la seguridad de la información procesal de nuestros usuarios.
          </p>
        </div>
      </section>
    </PublicShell>
  )
}

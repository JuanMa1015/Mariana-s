import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { getMe } from "../api"
import { useTitle } from "../hooks/useTitle"
import { AuditoriaAdmin, DispositivosAdmin, ResumenAdmin } from "./admin/OtrosAdmin"
import ProcesosAdmin from "./admin/ProcesosAdmin"
import PruebasAdmin from "./admin/PruebasAdmin"
import UsuariosAdmin from "./admin/UsuariosAdmin"

const SECCIONES = [
  { id: "resumen", nombre: "Resumen" },
  { id: "usuarios", nombre: "Usuarios" },
  { id: "procesos", nombre: "Procesos" },
  { id: "dispositivos", nombre: "Dispositivos" },
  { id: "pruebas", nombre: "Pruebas" },
  { id: "auditoria", nombre: "Auditoría" },
] as const
type Seccion = (typeof SECCIONES)[number]["id"]

/** Panel de administración: solo para cuentas con rol de administrador (el servidor vuelve a comprobarlo en cada llamada). */
export default function AdminPage() {
  useTitle("Administración")
  const navigate = useNavigate()
  const [acceso, setAcceso] = useState<"cargando" | "permitido" | "denegado" | "error">("cargando")
  const [yoId, setYoId] = useState<number | null>(null)
  const [intento, setIntento] = useState(0)
  const [seccion, setSeccion] = useState<Seccion>("resumen")

  useEffect(() => {
    let activa = true
    getMe()
      .then((me) => { if (activa) { setYoId(me.id ?? null); setAcceso(me.es_admin ? "permitido" : "denegado") } })
      .catch(() => { if (activa) setAcceso("error") })
    return () => { activa = false }
  }, [intento])

  if (acceso === "cargando") return <div className="flex min-h-screen items-center justify-center text-slate-500">Verificando permisos…</div>
  if (acceso === "error") return <main id="contenido" tabIndex={-1} className="p-6 text-slate-800"><p role="alert">No pudimos verificar tus permisos. Revisa tu conexión.</p><button className="mt-4 min-h-11 rounded-xl border px-4" onClick={() => { setAcceso("cargando"); setIntento((i) => i + 1) }}>Reintentar</button></main>
  if (acceso === "denegado") return <Navigate to="/procesos" replace />

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-indigo-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Administración</h1>
          </div>
          <button type="button" onClick={() => navigate("/ajustes")} className="min-h-11 rounded-full border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">Ajustes</button>
        </div>
        <nav aria-label="Secciones del panel" className="mx-auto w-full max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1">
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSeccion(s.id)}
                  aria-current={seccion === s.id ? "page" : undefined}
                  className={`min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition ${seccion === s.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                >
                  {s.nombre}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        {seccion === "resumen" && <ResumenAdmin irAPruebas={() => setSeccion("pruebas")} />}
        {seccion === "usuarios" && <UsuariosAdmin yoId={yoId} />}
        {seccion === "procesos" && <ProcesosAdmin />}
        {seccion === "dispositivos" && <DispositivosAdmin />}
        {seccion === "pruebas" && <PruebasAdmin />}
        {seccion === "auditoria" && <AuditoriaAdmin />}
      </main>
    </div>
  )
}

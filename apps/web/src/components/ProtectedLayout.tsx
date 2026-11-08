import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import { getMe } from "../api"
import { ApiError } from "../api/errors"
import { clearCache, setCacheUser } from "../api/cache"
import AvisosPush from "./AvisosPush"
import BottomNav from "./BottomNav"
import { limpiarAvatar } from "../hooks/useAvatar"

export default function ProtectedLayout() {
  const [estado, setEstado] = useState<"cargando" | "lista" | "error" | "vencida">("cargando")
  const [intento, setIntento] = useState(0)
  const [esAdmin, setEsAdmin] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let activa = true
    const expirar = () => { clearCache(); limpiarAvatar(); setEstado("vencida") }
    window.addEventListener("session-expired", expirar)
    getMe().then((usuario) => {
      if (!activa) return
      setCacheUser(usuario.email)
      limpiarAvatar()
      setEsAdmin(Boolean(usuario.es_admin))
      setEstado("lista")
    }).catch((error: unknown) => {
      if (activa) setEstado(error instanceof ApiError && error.status === 401 ? "vencida" : "error")
    })
    return () => {
      activa = false
      window.removeEventListener("session-expired", expirar)
    }
  }, [intento])

  if (estado === "vencida") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (estado === "cargando") {
    return <div role="status" className="grid min-h-dvh place-items-center text-slate-600">Verificando sesión…</div>
  }
  if (estado === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-4 text-slate-800">
        <section className="w-full max-w-md rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-bold">No pudimos verificar tu sesión</h1>
          <p role="alert" className="my-4 text-sm">Revisa tu conexión. Puedes volver a intentar sin ingresar otra vez tus credenciales.</p>
          <button className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white"
            onClick={() => { setEstado("cargando"); setIntento((i) => i + 1) }}>Reintentar</button>
        </section>
      </main>
    )
  }
  const ruta = location.pathname.replace(/\/+$/, "").toLowerCase()
  if (esAdmin && ruta !== "/admin" && ruta !== "/ajustes") {
    return <Navigate to="/admin" replace />
  }
  return (
    <div className={esAdmin ? undefined : "private-layout"}>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      {!esAdmin && <AvisosPush onAbrirProceso={(llave) => navigate(`/procesos/${llave}`)} />}
      <Outlet context={esAdmin} />
      {!esAdmin && <BottomNav />}
    </div>
  )
}

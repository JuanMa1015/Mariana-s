import { useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { olvidePassword, restablecerPassword } from "../api"
import { useTitle } from "../hooks/useTitle"

const entrada = "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
const etiqueta = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-600"
const boton = "mt-2 w-full rounded-2xl border border-violet-500 bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-95 disabled:opacity-50"

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Mariana's</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

/** «Olvidé mi contraseña»: pide el correo y envía el enlace. La respuesta es la misma exista o no la cuenta. */
export function OlvidePage() {
  useTitle("Recuperar contraseña")
  const [email, setEmail] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    try {
      await olvidePassword(email.trim())
      setEnviado(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el correo")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta titulo="Recuperar contraseña">
      {enviado ? (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Si <strong>{email}</strong> tiene una cuenta, te enviamos un enlace para elegir una nueva contraseña. Revisa también la carpeta de spam; el enlace vence en 30 minutos.
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Escribe el correo de tu cuenta y te enviaremos un enlace para restablecerla.</p>
          <div>
            <label htmlFor="olvide-email" className={etiqueta}>Correo</label>
            <input id="olvide-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={entrada} placeholder="tu@correo.com" />
          </div>
          <button type="submit" disabled={enviando} className={boton}>{enviando ? "Enviando..." : "Enviarme el enlace"}</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-semibold text-violet-500 hover:underline">Volver a iniciar sesión</Link>
      </p>
    </Tarjeta>
  )
}

/** Destino del enlace del correo: el token viaja en el fragmento (#token=...), no llega a ningún servidor ni log. */
export function RestablecerPage() {
  useTitle("Nueva contraseña")
  const navigate = useNavigate()
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "")
  const [password, setPassword] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres")
    if (password !== confirmar) return setError("Las contraseñas no coinciden")
    setError("")
    setGuardando(true)
    try {
      await restablecerPassword(token, password)
      toast.success("Contraseña actualizada. Inicia sesión con la nueva.")
      navigate("/login", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña")
    } finally {
      setGuardando(false)
    }
  }

  if (!token) {
    return (
      <Tarjeta titulo="Enlace no válido">
        <p className="text-sm text-slate-600">Este enlace está incompleto. Solicita uno nuevo desde «¿Olvidaste tu contraseña?».</p>
        <p className="mt-6 text-center text-sm"><Link to="/olvide" className="font-semibold text-violet-500 hover:underline">Solicitar enlace nuevo</Link></p>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta titulo="Elige tu nueva contraseña">
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div>
          <label htmlFor="nueva-password" className={etiqueta}>Nueva contraseña</label>
          <input id="nueva-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={entrada} />
          <p className="mt-1 text-xs text-slate-500">Mínimo 8 caracteres.</p>
        </div>
        <div>
          <label htmlFor="confirmar-password" className={etiqueta}>Repite la contraseña</label>
          <input id="confirmar-password" type="password" required autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className={entrada} />
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error} {error.includes("enlace") && <Link to="/olvide" className="underline">Solicitar uno nuevo</Link>}</p>}
        <button type="submit" disabled={guardando} className={boton}>{guardando ? "Guardando..." : "Cambiar contraseña"}</button>
      </form>
    </Tarjeta>
  )
}

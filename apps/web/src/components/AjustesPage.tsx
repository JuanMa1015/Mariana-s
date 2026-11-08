import { useEffect, useId, useRef, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import toast from "react-hot-toast"
import { borrarAvatar, cambiarUsuario, solicitarCambioPassword, subirAvatar } from "../api"
import { pushDisponible } from "../push"
import { useAvatar, recargarAvatar } from "../hooks/useAvatar"
import { useTitle } from "../hooks/useTitle"
import { cerrarSesion } from "../session"
import { guardarTema, temaGuardado, type Tema } from "../theme"
import { redimensionarAvatar } from "../utils/imagen"
import Avatar from "./Avatar"
import AjustesAvisos from "./AjustesAvisos"

const TEMAS: { valor: Tema; titulo: string }[] = [
  { valor: "claro", titulo: "Claro" },
  { valor: "oscuro", titulo: "Oscuro" },
  { valor: "sistema", titulo: "Automático" },
]

const tarjeta = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
const etiqueta = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-600"
const entrada = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
const botonPrimario = "min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
const botonSecundario = "min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"

export default function AjustesPage() {
  useTitle("Ajustes")
  const navigate = useNavigate()
  const avatar = useAvatar()
  const email = localStorage.getItem("email") ?? ""
  const [username, setUsername] = useState(() => localStorage.getItem("username") || email.split("@")[0] || "")
  const [tema, setTema] = useState<Tema>(temaGuardado)
  const [editandoUsuario, setEditandoUsuario] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState("")
  const [passwordActual, setPasswordActual] = useState("")
  const [ocupado, setOcupado] = useState<null | "foto" | "usuario" | "password">(null)
  const archivoRef = useRef<HTMLInputElement>(null)
  const [errorUsuario, setErrorUsuario] = useState("")
  const [resultadoPassword, setResultadoPassword] = useState("")
  const usuarioRef = useRef<HTMLInputElement>(null)
  const editarRef = useRef<HTMLButtonElement>(null)
  const devolverFoco = useRef(false)

  const esAdmin = useOutletContext<boolean>()

  useEffect(() => {
    if (editandoUsuario) usuarioRef.current?.focus()
    else if (devolverFoco.current) {
      editarRef.current?.focus()
      devolverFoco.current = false
    }
  }, [editandoUsuario])

  const idUsuario = useId()
  const idPassword = useId()

  const elegirTema = (t: Tema) => {
    setTema(t)
    guardarTema(t)
  }

  const cambiarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = "" // permite elegir la misma foto otra vez
    if (!archivo) return
    if (!archivo.type.startsWith("image/")) return void toast.error("Elige un archivo de imagen")
    setOcupado("foto")
    try {
      await subirAvatar(await redimensionarAvatar(archivo))
      await recargarAvatar()
      toast.success("Foto actualizada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la foto")
    } finally {
      setOcupado(null)
    }
  }

  const quitarFoto = async () => {
    setOcupado("foto")
    try {
      await borrarAvatar()
      await recargarAvatar()
      toast.success("Foto eliminada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar la foto")
    } finally {
      setOcupado(null)
    }
  }

  const guardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorUsuario("")
    setOcupado("usuario")
    try {
      const r = await cambiarUsuario(nuevoUsuario.trim(), passwordActual)
      localStorage.setItem("username", r.username)
      setUsername(r.username)
      devolverFoco.current = true
      setEditandoUsuario(false)
      setNuevoUsuario("")
      setPasswordActual("")
      toast.success("Nombre de usuario actualizado")
    } catch (err) {
      setErrorUsuario(err instanceof Error ? err.message : "No se pudo cambiar el usuario.")
    } finally {
      setOcupado(null)
    }
  }

  const pedirCambioPassword = async () => {
    setResultadoPassword("")
    setOcupado("password")
    try {
      const r = await solicitarCambioPassword()
      setResultadoPassword(`Te enviamos un enlace a ${r.email}. Vence en 30 minutos.`)
    } catch (err) {
      setResultadoPassword(err instanceof Error ? err.message : "No se pudo enviar el correo.")
    } finally {
      setOcupado(null)
    }
  }

  const salir = async () => {
    await cerrarSesion()
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-indigo-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Ajustes</h1>
          </div>
          <button type="button" onClick={() => navigate(esAdmin ? "/admin" : "/procesos")} className={`${esAdmin ? "inline-flex" : "hidden sm:inline-flex"} min-h-11 items-center rounded-full border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100`}>
            {esAdmin ? "Volver a Administración" : "Volver a procesos"}
          </button>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
        {!esAdmin && pushDisponible && <AjustesAvisos tarjeta={tarjeta} boton={botonSecundario} />}

        <section className={tarjeta} aria-labelledby="t-perfil">
          <h2 id="t-perfil" className="text-sm font-bold text-slate-800">Mi cuenta</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar nombre={username} url={avatar} tamano="h-12 w-12 text-sm" />
            <div className="flex flex-wrap gap-2">
              <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={cambiarFoto} aria-label="Elegir foto de perfil" />
              <button type="button" disabled={ocupado === "foto"} onClick={() => archivoRef.current?.click()} className={botonSecundario}>
                {avatar ? "Cambiar foto" : "Subir foto"}
              </button>
              {avatar && (
                <button type="button" disabled={ocupado === "foto"} onClick={quitarFoto} className={`${botonSecundario} !border-rose-200 !text-rose-600`}>
                  Quitar
                </button>
              )}
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className={etiqueta}>Correo</dt>
              <dd className="break-words text-slate-800">{email || "—"}</dd>
            </div>
            <div>
              <dt className={etiqueta}>Nombre de usuario</dt>
              <dd className="flex flex-wrap items-center justify-between gap-3 text-slate-800">
                <span className="min-w-0 break-words">{username}</span>
                {!editandoUsuario && (
                  <button type="button" ref={editarRef} onClick={() => { setErrorUsuario(""); setEditandoUsuario(true) }} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Cambiar usuario</button>
                )}
              </dd>
            </div>
          </dl>

          {editandoUsuario && (
            <form onSubmit={guardarUsuario} className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div>
                <label htmlFor={idUsuario} className={etiqueta}>Nuevo nombre de usuario</label>
                <input ref={usuarioRef} id={idUsuario} value={nuevoUsuario} onChange={(e) => setNuevoUsuario(e.target.value)} required minLength={3} maxLength={30} autoComplete="username" className={entrada} placeholder="3 a 30 letras, números, . o _" />
              </div>
              <div>
                <label htmlFor={idPassword} className={etiqueta}>Tu contraseña actual</label>
                <input id={idPassword} type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} required autoComplete="current-password" className={entrada} />
                <p className="mt-1 text-xs text-slate-500">La pedimos para confirmar que eres tú.</p>
              </div>
              {errorUsuario && <p role="alert" className="text-sm text-rose-700">{errorUsuario}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={ocupado === "usuario"} onClick={() => { devolverFoco.current = true; setEditandoUsuario(false); setNuevoUsuario(""); setPasswordActual(""); setErrorUsuario("") }} className={botonSecundario}>Cancelar</button>
                <button type="submit" disabled={ocupado === "usuario"} className={botonPrimario}>Guardar</button>
              </div>
            </form>
          )}
          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold text-slate-800">Contraseña</h3>
            <p className="mt-2 text-sm text-slate-600">Para cambiar tu contraseña te enviamos un enlace de un solo uso a tu correo. Al cambiarla se cierran tus sesiones abiertas.</p>
            <button type="button" disabled={ocupado === "password"} onClick={pedirCambioPassword} className={`${botonPrimario} mt-3`}>
              {ocupado === "password" ? "Enviando..." : "Enviarme el enlace por correo"}
            </button>
            {resultadoPassword && <p role="status" className="mt-3 break-words text-sm text-slate-700">{resultadoPassword}</p>}
          </div>
        </section>

        <section className={tarjeta} aria-labelledby="t-apariencia">
          <h2 id="t-apariencia" className="text-sm font-bold text-slate-800">Apariencia</h2>
          <div role="radiogroup" aria-labelledby="t-apariencia" className="mt-3 flex flex-wrap gap-2">
            {TEMAS.map((t) => (
              <label key={t.valor} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600 ${tema === t.valor ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>
                <input type="radio" name="tema" value={t.valor} checked={tema === t.valor} onChange={() => elegirTema(t.valor)} className="shrink-0 accent-indigo-600" />
                {t.titulo}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-600">Automático sigue la apariencia de tu dispositivo.</p>
        </section>

        <section className={tarjeta} aria-labelledby="t-ayuda">
          <h2 id="t-ayuda" className="text-sm font-bold text-slate-800">{esAdmin ? "Versión" : "Ayuda y versión"}</h2>
          {!esAdmin && (
            <a href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion" target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700 underline">
              Consulta oficial de Rama Judicial ↗
            </a>
          )}
          <p className="mt-2 text-xs text-slate-600">Mariana's v{__APP_VERSION__}</p>
        </section>
        <div className="border-t border-slate-200 pt-4">
          <button type="button" onClick={salir} className={`${botonSecundario} !border-rose-200 !text-rose-600`}>Cerrar sesión</button>
        </div>
      </main>
    </div>
  )
}

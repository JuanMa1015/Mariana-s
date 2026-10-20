import { useEffect, useId, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { borrarAvatar, cambiarUsuario, enviarAvisoDePrueba, getMe, solicitarCambioPassword, subirAvatar } from "../api"
import { activarPush, pedirPermiso, permisoActual, pushDisponible, type EstadoPermiso } from "../push"
import { useAvatar, recargarAvatar } from "../hooks/useAvatar"
import { useTitle } from "../hooks/useTitle"
import { cerrarSesion } from "../session"
import { guardarTema, temaGuardado, type Tema } from "../theme"
import { redimensionarAvatar } from "../utils/imagen"
import Avatar from "./Avatar"

const TEMAS: { valor: Tema; titulo: string; detalle: string }[] = [
  { valor: "claro", titulo: "Claro", detalle: "Fondo blanco" },
  { valor: "oscuro", titulo: "Oscuro", detalle: "Descansa la vista de noche" },
  { valor: "sistema", titulo: "Automático", detalle: "Igual que tu celular o computador" },
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
  const [permiso, setPermiso] = useState<EstadoPermiso | null>(null)
  // Herramienta de soporte oculta (como el «modo desarrollador» de Android): 7 toques sobre la versión
  const [toquesVersion, setToquesVersion] = useState(0)
  const modoSoporte = toquesVersion >= 7

  const [esAdmin, setEsAdmin] = useState(false)

  useEffect(() => {
    getMe().then((me) => setEsAdmin(Boolean(me.es_admin))).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (pushDisponible) permisoActual().then(setPermiso).catch(() => undefined)
  }, [])

  const activarAvisos = async () => {
    try {
      const nuevo = await pedirPermiso()
      setPermiso(nuevo)
      if (nuevo === "granted") {
        await activarPush()
        toast.success("Avisos activados")
      }
    } catch {
      toast.error("No se pudieron activar los avisos")
    }
  }

  const probarAvisos = async (demora: number) => {
    const t = toast.loading("Enviando aviso de prueba...")
    try {
      const r = await enviarAvisoDePrueba(demora)
      if (r.programado_en) toast.success(`Programado: llega en ${r.programado_en} s. Cierra la app ahora.`, { id: t, duration: 6000 })
      else if (r.enviados > 0) toast.success("Enviado", { id: t })
      else toast.error(`FCM no lo aceptó: ${r.errores?.[0] ?? (r.caducados ? "el celular estaba caducado; abre la app de nuevo" : "sin detalle")}`, { id: t, duration: 8000 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar", { id: t })
    }
  }

  const tocarVersion = () => {
    const n = toquesVersion + 1
    setToquesVersion(n)
    if (n === 7) toast("Herramientas de soporte activadas", { icon: "🛠️" })
  }
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
    setOcupado("usuario")
    try {
      const r = await cambiarUsuario(nuevoUsuario.trim(), passwordActual)
      localStorage.setItem("username", r.username)
      setUsername(r.username)
      setEditandoUsuario(false)
      setNuevoUsuario("")
      setPasswordActual("")
      toast.success("Nombre de usuario actualizado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el usuario")
    } finally {
      setOcupado(null)
    }
  }

  const pedirCambioPassword = async () => {
    setOcupado("password")
    try {
      const r = await solicitarCambioPassword()
      toast.success(`Te enviamos un enlace a ${r.email}. Vence en 30 minutos.`, { duration: 8000 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el correo")
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
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Mariana's</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Ajustes</h1>
          </div>
          <button type="button" onClick={() => navigate("/procesos")} className="min-h-10 rounded-full border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
            ← Volver
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
        <section className={tarjeta} aria-labelledby="t-perfil">
          <h2 id="t-perfil" className="text-sm font-bold text-slate-800">Perfil</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar nombre={username} url={avatar} tamano="h-20 w-20 text-xl" />
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
              <dd className="text-slate-800">{email || "—"}</dd>
            </div>
            <div>
              <dt className={etiqueta}>Nombre de usuario</dt>
              <dd className="flex items-center justify-between gap-3 text-slate-800">
                <span>{username}</span>
                {!editandoUsuario && (
                  <button type="button" onClick={() => setEditandoUsuario(true)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Cambiar</button>
                )}
              </dd>
            </div>
          </dl>

          {editandoUsuario && (
            <form onSubmit={guardarUsuario} className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div>
                <label htmlFor={idUsuario} className={etiqueta}>Nuevo nombre de usuario</label>
                <input id={idUsuario} value={nuevoUsuario} onChange={(e) => setNuevoUsuario(e.target.value)} required minLength={3} maxLength={30} autoComplete="username" className={entrada} placeholder="3 a 30 letras, números, . o _" />
              </div>
              <div>
                <label htmlFor={idPassword} className={etiqueta}>Tu contraseña actual</label>
                <input id={idPassword} type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} required autoComplete="current-password" className={entrada} />
                <p className="mt-1 text-xs text-slate-500">La pedimos para confirmar que eres tú.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setEditandoUsuario(false); setPasswordActual("") }} className={botonSecundario}>Cancelar</button>
                <button type="submit" disabled={ocupado === "usuario"} className={botonPrimario}>Guardar</button>
              </div>
            </form>
          )}
        </section>

        <section className={tarjeta} aria-labelledby="t-apariencia">
          <h2 id="t-apariencia" className="text-sm font-bold text-slate-800">Apariencia</h2>
          <div role="radiogroup" aria-labelledby="t-apariencia" className="mt-3 grid gap-2 sm:grid-cols-3">
            {TEMAS.map((t) => (
              <label key={t.valor} className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border px-4 py-2 text-sm transition ${tema === t.valor ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" name="tema" value={t.valor} checked={tema === t.valor} onChange={() => elegirTema(t.valor)} className="sr-only" />
                <span className="font-semibold text-slate-800">{t.titulo}</span>
                <span className="text-xs text-slate-500">{t.detalle}</span>
              </label>
            ))}
          </div>
        </section>

        {pushDisponible && (
          <section className={tarjeta} aria-labelledby="t-avisos">
            <h2 id="t-avisos" className="text-sm font-bold text-slate-800">Notificaciones</h2>
            {permiso === "granted" && <p className="mt-2 text-sm text-slate-600">Activadas: te avisamos en este celular cuando uno de tus procesos tenga actuaciones nuevas, aunque la app esté cerrada.</p>}
            {permiso === "prompt" && (
              <>
                <p className="mt-2 text-sm text-slate-600">Recibe un aviso al instante cuando haya actuaciones nuevas en tus procesos.</p>
                <button type="button" onClick={activarAvisos} className={`${botonPrimario} mt-3`}>Activar avisos</button>
              </>
            )}
            {permiso === "denied" && <p className="mt-2 text-sm text-slate-600">Están bloqueadas. Actívalas en los ajustes del celular: Aplicaciones → Mariana's → Notificaciones.</p>}
            {modoSoporte && permiso === "granted" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">Soporte: probar avisos</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => probarAvisos(0)} className={botonSecundario}>Enviar ahora</button>
                  <button type="button" onClick={() => probarAvisos(15)} className={botonSecundario}>Enviar en 15 s</button>
                </div>
                <p className="mt-2 text-xs text-amber-800">Con «en 15 s» cierra la app por completo: el aviso debe llegar a la bandeja del celular.</p>
              </div>
            )}
          </section>
        )}

        <section className={tarjeta} aria-labelledby="t-seguridad">
          <h2 id="t-seguridad" className="text-sm font-bold text-slate-800">Seguridad</h2>
          <p className="mt-2 text-sm text-slate-600">Para cambiar tu contraseña te enviamos un enlace de un solo uso a tu correo. Al cambiarla se cierran tus sesiones abiertas.</p>
          <button type="button" disabled={ocupado === "password"} onClick={pedirCambioPassword} className={`${botonPrimario} mt-3`}>
            {ocupado === "password" ? "Enviando..." : "Enviarme el enlace por correo"}
          </button>
        </section>

        {esAdmin && (
          <section className={tarjeta} aria-labelledby="t-admin">
            <h2 id="t-admin" className="text-sm font-bold text-slate-800">Administración</h2>
            <p className="mt-2 text-sm text-slate-600">Usuarios, procesos, dispositivos, pruebas del sistema y registro de actividad.</p>
            <button type="button" onClick={() => navigate("/admin")} className={`${botonPrimario} mt-3`}>Abrir panel de administración</button>
          </section>
        )}

        <section className={tarjeta} aria-labelledby="t-cuenta">
          <h2 id="t-cuenta" className="text-sm font-bold text-slate-800">Cuenta</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion" target="_blank" rel="noreferrer" className={`${botonSecundario} inline-flex items-center`}>
              Consulta oficial Rama Judicial ↗
            </a>
            <button type="button" onClick={salir} className={`${botonSecundario} !border-rose-200 !text-rose-600`}>Cerrar sesión</button>
          </div>
          <button type="button" onClick={tocarVersion} className="mt-4 block min-h-8 text-xs text-slate-500">Mariana's v{__APP_VERSION__}</button>
        </section>
      </main>
    </div>
  )
}

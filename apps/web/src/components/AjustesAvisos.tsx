import { useEffect, useState, useSyncExternalStore } from "react"
import { enviarAvisoDePrueba } from "../api"
import { activarPush, estadoRegistroPush, pedirPermiso, permisoActual, suscribirRegistroPush, type EstadoPermiso } from "../push"

const permisoTexto = { prompt: "Por conceder", granted: "Concedido", denied: "Bloqueado" }
const registroTexto = {
  pendiente: "Pendiente de confirmar",
  registrando: "Registrando…",
  registrado: "Confirmado",
  error: "No se pudo registrar",
}

export default function AjustesAvisos({ tarjeta, boton }: { tarjeta: string; boton: string }) {
  const [permiso, setPermiso] = useState<EstadoPermiso | null>(null)
  const [errorPermiso, setErrorPermiso] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ texto: string; confirmar?: boolean } | null>(null)
  const registro = useSyncExternalStore(suscribirRegistroPush, estadoRegistroPush)
  const listo = !errorPermiso && permiso === "granted" && registro === "registrado"

  useEffect(() => {
    let activo = true
    let revision = 0
    const consultar = async () => {
      const actual = ++revision
      try {
        const estado = await permisoActual()
        if (!activo || actual !== revision) return
        setPermiso(estado)
        setErrorPermiso(false)
      } catch {
        if (activo && actual === revision) {
          setPermiso(null)
          setErrorPermiso(true)
        }
      }
    }
    const alVolver = () => {
      if (document.visibilityState === "visible") void consultar()
    }
    void consultar()
    document.addEventListener("visibilitychange", alVolver)
    window.addEventListener("focus", alVolver)
    return () => {
      activo = false
      document.removeEventListener("visibilitychange", alVolver)
      window.removeEventListener("focus", alVolver)
    }
  }, [])

  async function configurar() {
    setPidiendo(true)
    setResultado(null)
    try {
      const estado = permiso === "granted" ? permiso : await pedirPermiso()
      setPermiso(estado)
      setErrorPermiso(false)
      if (estado === "granted") await activarPush()
    } catch {
      setResultado({ texto: "No pudimos configurar los avisos. Intenta nuevamente." })
    } finally {
      setPidiendo(false)
    }
  }

  async function probar(demora: number) {
    setEnviando(true)
    setResultado(null)
    try {
      const respuesta = await enviarAvisoDePrueba(demora)
      if (respuesta.programado_en) {
        setResultado({ texto: `Prueba programada en ${respuesta.programado_en} segundos. Sal de la app y revisa tus notificaciones.`, confirmar: true })
      } else if (respuesta.enviados > 0) {
        setResultado({ texto: "Aviso de prueba enviado. Revisa tus notificaciones o el aviso dentro de la app.", confirmar: true })
      } else {
        setResultado({ texto: "El servicio no aceptó el aviso de prueba. Intenta de nuevo más tarde." })
      }
    } catch {
      setResultado({ texto: "No pudimos enviar el aviso de prueba. Revisa la conexión e inténtalo de nuevo." })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className={tarjeta} aria-labelledby="t-avisos">
      <h2 id="t-avisos" className="text-base font-bold text-slate-800">Avisos de actuaciones</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-x-3">
          <dt>Permiso del celular</dt>
          <dd className="font-semibold">{errorPermiso ? "Sin verificar" : permiso ? permisoTexto[permiso] : "Verificando…"}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3">
          <dt>Registro de este dispositivo</dt>
          <dd className="font-semibold" aria-live="polite">{registroTexto[registro]}</dd>
        </div>
      </dl>
      {permiso === "denied" && <p className="mt-3 text-sm text-slate-600">Permite los avisos en los ajustes del celular, en Aplicaciones → Mariana’s → Notificaciones. Luego vuelve aquí.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {(permiso === "prompt" || errorPermiso || (permiso === "granted" && registro !== "registrado")) &&
          <button type="button" className={boton} disabled={pidiendo || registro === "registrando"} onClick={configurar}>
            {pidiendo || registro === "registrando" ? "Configurando…" : permiso === "granted" ? "Reintentar registro" : "Activar avisos"}
          </button>}
        {listo && <>
          <button type="button" className={boton} disabled={enviando || pidiendo} onClick={() => probar(0)}>{enviando ? "Enviando…" : "Enviar aviso de prueba"}</button>
          <button type="button" className={boton} disabled={enviando || pidiendo} onClick={() => probar(15)}>Probar con la app cerrada</button>
        </>}
      </div>
      {listo && <p className="mt-2 text-xs text-slate-600">La prueba se envía a los dispositivos registrados en tu cuenta.</p>}
      {resultado && <p role="status" className="mt-3 text-sm text-slate-700">{resultado.texto}</p>}
      {resultado?.confirmar && listo && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">¿Llegó a este celular?</p>
          <button type="button" className={boton} onClick={() => setResultado({ texto: "Confirmaste que el aviso llegó a este celular." })}>Sí, llegó</button>
          <button type="button" className={boton} onClick={() => setResultado({ texto: "Revisa que las notificaciones de Mariana’s estén permitidas y que el modo No molestar esté desactivado. Luego prueba de nuevo." })}>No llegó</button>
        </div>
      )}
    </section>
  )
}

import { useId, useState } from "react"
import { apiJson } from "../../api"
import { formatearRadicado } from "../../utils/radicado"
import Modal from "../Modal"
import { accion, botonMini, botonPrimario, botonSecundario, Confirmar, entrada, ErrorCarga, etiqueta, fecha, Insignia, LIMITE, Paginador, Tabla, tarjeta, useLista } from "./comunes"
import type { UsuarioAdmin } from "./UsuariosAdmin"

interface ProcesoAdmin {
  id: number
  usuario_id: number
  usuario_email: string | null
  llave_proceso: string
  alias: string | null
  despacho: string | null
  categoria: string | null
  notificado: boolean
  ultima_sincronizacion: string | null
  fallos_consecutivos: number | null
  notificacion_pendiente: boolean | null
  canales_notificados: string | null
}

function FormProceso({ proceso, onCerrar, onGuardado }: { proceso?: ProcesoAdmin; onCerrar: () => void; onGuardado: () => void }) {
  const id = useId()
  const usuarios = useLista<{ usuarios: UsuarioAdmin[] }>("/panel/usuarios?limit=100")
  const [usuarioId, setUsuarioId] = useState(proceso?.usuario_id ?? 0)
  const [radicado, setRadicado] = useState(proceso?.llave_proceso ?? "")
  const [alias, setAlias] = useState(proceso?.alias ?? "")
  const [categoria, setCategoria] = useState(proceso?.categoria ?? "General")
  const [notificado, setNotificado] = useState(proceso?.notificado ?? true)
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    const ok = proceso
      ? await accion(apiJson(`/panel/procesos/${proceso.id}`, { method: "PATCH", body: { alias, categoria, notificado } }), "Proceso actualizado", onGuardado)
      : await accion(apiJson("/panel/procesos", { method: "POST", body: { usuario_id: usuarioId, llave_proceso: radicado, categoria, alias: alias || undefined } }), "Proceso creado", onGuardado)
    setGuardando(false)
    if (ok) onCerrar()
  }

  return (
    <Modal titulo={proceso ? "Editar proceso" : "Nuevo proceso"} onClose={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        {proceso ? (
          <p className="font-mono text-sm text-slate-700">{formatearRadicado(proceso.llave_proceso)} <span className="font-sans text-xs text-slate-500">· {proceso.usuario_email}</span></p>
        ) : (
          <>
            <div>
              <label htmlFor={`${id}-u`} className={etiqueta}>Usuario</label>
              <select id={`${id}-u`} required value={usuarioId} onChange={(e) => setUsuarioId(Number(e.target.value))} className={entrada}>
                <option value={0} disabled>Elige un usuario…</option>
                {usuarios.datos?.usuarios.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-r`} className={etiqueta}>Radicado (23 dígitos)</label>
              <input id={`${id}-r`} required inputMode="numeric" maxLength={23} value={radicado} onChange={(e) => setRadicado(e.target.value.replace(/\D/g, ""))} className={entrada} />
            </div>
          </>
        )}
        <div><label htmlFor={`${id}-a`} className={etiqueta}>Cliente o alias</label><input id={`${id}-a`} maxLength={100} value={alias} onChange={(e) => setAlias(e.target.value)} className={entrada} /></div>
        <div>
          <label htmlFor={`${id}-c`} className={etiqueta}>Categoría</label>
          <select id={`${id}-c`} value={categoria} onChange={(e) => setCategoria(e.target.value)} className={entrada}><option>General</option><option>Trabajo</option><option>Consultorio</option></select>
        </div>
        {proceso && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={notificado} onChange={(e) => setNotificado(e.target.checked)} className="h-4 w-4 rounded" /> Revisado (sin novedad pendiente)</label>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={botonSecundario}>Cancelar</button>
          <button type="submit" disabled={guardando || (!proceso && (!usuarioId || radicado.length !== 23))} className={botonPrimario}>{proceso ? "Guardar" : "Crear"}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function ProcesosAdmin() {
  const [q, setQ] = useState("")
  const [estado, setEstado] = useState("")
  const [skip, setSkip] = useState(0)
  const [editando, setEditando] = useState<ProcesoAdmin | "nuevo" | null>(null)
  const [aEliminar, setAEliminar] = useState<ProcesoAdmin | null>(null)
  const ruta = `/panel/procesos?skip=${skip}&limit=${LIMITE}${q ? `&q=${encodeURIComponent(q)}` : ""}${estado ? `&estado=${estado}` : ""}`
  const { datos, error, recargar } = useLista<{ total: number; procesos: ProcesoAdmin[] }>(ruta)

  return (
    <section className="flex flex-col gap-3" aria-label="Procesos">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Buscar proceso" value={q} onChange={(e) => { setQ(e.target.value); setSkip(0) }} placeholder="Radicado, alias, despacho o usuario" className={`${entrada} max-w-xs`} />
        <select aria-label="Filtrar procesos por estado" value={estado} onChange={(e) => { setEstado(e.target.value); setSkip(0) }} className={`${entrada} max-w-[13rem]`}>
          <option value="">Todos</option><option value="novedad">Con novedad</option><option value="al_dia">Al día</option><option value="con_fallos">Con fallos de sync</option><option value="aviso_pendiente">Aviso sin entregar</option>
        </select>
        <button type="button" className={`${botonPrimario} ml-auto`} onClick={() => setEditando("nuevo")}>+ Nuevo proceso</button>
      </div>
      {error && <ErrorCarga mensaje={error} />}
      <div className={tarjeta}>
        <Tabla columnas={["Radicado", "Usuario", "Estado", "Última sync", "Acciones"]} vacio={datos && datos.procesos.length === 0 ? "Sin resultados" : undefined}>
          {datos?.procesos.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2.5"><p className="font-mono text-xs font-bold text-slate-800">{formatearRadicado(p.llave_proceso)}</p><p className="max-w-[18rem] truncate text-xs text-slate-500">{p.alias ? `${p.alias} · ` : ""}{p.despacho || "Sin despacho"}</p></td>
              <td className="px-3 py-2.5 text-xs text-slate-600">{p.usuario_email}</td>
              <td className="px-3 py-2.5 space-x-1">
                {p.notificado ? <Insignia tono="verde">Al día</Insignia> : <Insignia tono="ambar">Con novedad</Insignia>}
                {!!p.fallos_consecutivos && <Insignia tono="rojo">{p.fallos_consecutivos} fallo(s)</Insignia>}
                {p.notificacion_pendiente && <Insignia tono="ambar">Aviso pendiente</Insignia>}
                {!p.notificado && !p.notificacion_pendiente && <Insignia tono={p.canales_notificados?.includes("push") ? "verde" : "gris"}>{p.canales_notificados ? `Avisó: ${p.canales_notificados.replace("email", "correo").replaceAll("+", " + ")}` : "Sin registro de aviso"}</Insignia>}
              </td>
              <td className="px-3 py-2.5 text-xs text-slate-600">{fecha(p.ultima_sincronizacion)}</td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={botonMini} onClick={() => setEditando(p)}>Editar</button>
                  <button type="button" className={botonMini} onClick={() => accion(apiJson(`/panel/procesos/${p.id}/reprogramar-sync`, { method: "POST" }), "Se sincronizará en la próxima ronda", recargar)}>Re-sincronizar</button>
                  <button type="button" className={`${botonMini} !border-rose-200 !text-rose-600`} onClick={() => setAEliminar(p)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
        </Tabla>
        {datos && <Paginador total={datos.total} skip={skip} onCambio={setSkip} />}
      </div>
      {editando && <FormProceso proceso={editando === "nuevo" ? undefined : editando} onCerrar={() => setEditando(null)} onGuardado={recargar} />}
      {aEliminar && (
        <Confirmar
          titulo="¿Eliminar este proceso?"
          textoBoton="Sí, eliminar"
          mensaje={<><p className="font-mono text-slate-800">{formatearRadicado(aEliminar.llave_proceso)}</p><p className="mt-2">De {aEliminar.usuario_email}. Se borra con su historial de actuaciones.</p></>}
          onCerrar={() => setAEliminar(null)}
          onConfirmar={() => { const p = aEliminar; setAEliminar(null); void accion(apiJson(`/panel/procesos/${p.id}`, { method: "DELETE" }), "Proceso eliminado", recargar) }}
        />
      )}
    </section>
  )
}

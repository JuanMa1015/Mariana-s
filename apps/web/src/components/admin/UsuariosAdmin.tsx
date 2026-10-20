import { useId, useState } from "react"
import { apiJson } from "../../api"
import Modal from "../Modal"
import { accion, botonMini, botonPrimario, botonSecundario, Confirmar, entrada, ErrorCarga, etiqueta, fecha, Insignia, LIMITE, Paginador, Tabla, tarjeta, useLista } from "./comunes"

export interface UsuarioAdmin {
  id: number
  email: string
  username: string | null
  activo: boolean
  es_admin: boolean
  admin_por_correo: boolean
  telegram_chat_id: string | null
  creado_en: string | null
  ultimo_acceso: string | null
  procesos: number
  dispositivos: number
}

interface Lista { total: number; usuarios: UsuarioAdmin[] }

function FormUsuario({ usuario, onCerrar, onGuardado }: { usuario?: UsuarioAdmin; onCerrar: () => void; onGuardado: () => void }) {
  const id = useId()
  const [email, setEmail] = useState(usuario?.email ?? "")
  const [username, setUsername] = useState(usuario?.username ?? "")
  const [telegram, setTelegram] = useState(usuario?.telegram_chat_id ?? "")
  const [admin, setAdmin] = useState(usuario?.es_admin ?? false)
  const [password, setPassword] = useState("")
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    const ok = usuario
      ? await accion(apiJson(`/panel/usuarios/${usuario.id}`, { method: "PATCH", body: { email, username, telegram_chat_id: telegram, es_admin: admin } }), "Usuario actualizado", onGuardado)
      : await accion(apiJson("/panel/usuarios", { method: "POST", body: { email, username: username || undefined, es_admin: admin, password: password || undefined } }), password ? "Usuario creado" : "Usuario creado: se envió la invitación por correo", onGuardado)
    setGuardando(false)
    if (ok) onCerrar()
  }

  return (
    <Modal titulo={usuario ? "Editar usuario" : "Nuevo usuario"} onClose={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div><label htmlFor={`${id}-e`} className={etiqueta}>Correo</label><input id={`${id}-e`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={entrada} /></div>
        <div><label htmlFor={`${id}-u`} className={etiqueta}>Usuario</label><input id={`${id}-u`} value={username} onChange={(e) => setUsername(e.target.value)} className={entrada} placeholder={usuario ? "" : "Opcional: se genera del correo"} /></div>
        {usuario && <div><label htmlFor={`${id}-t`} className={etiqueta}>Chat de Telegram</label><input id={`${id}-t`} value={telegram} onChange={(e) => setTelegram(e.target.value)} className={entrada} placeholder="Vacío = sin vincular" /></div>}
        {!usuario && (
          <div>
            <label htmlFor={`${id}-p`} className={etiqueta}>Contraseña (opcional)</label>
            <input id={`${id}-p`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={entrada} />
            <p className="mt-1 text-xs text-slate-500">Si la dejas vacía, la persona recibe un correo para elegir la suya.</p>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} disabled={usuario?.admin_por_correo} className="h-4 w-4 rounded" />
          Administrador {usuario?.admin_por_correo && <span className="text-xs text-slate-500">(definido en ADMIN_EMAILS)</span>}
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={botonSecundario}>Cancelar</button>
          <button type="submit" disabled={guardando} className={botonPrimario}>{usuario ? "Guardar" : "Crear"}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function UsuariosAdmin({ yoId }: { yoId: number | null }) {
  const [q, setQ] = useState("")
  const [estado, setEstado] = useState("")
  const [skip, setSkip] = useState(0)
  const [editando, setEditando] = useState<UsuarioAdmin | "nuevo" | null>(null)
  const [aEliminar, setAEliminar] = useState<UsuarioAdmin | null>(null)
  const ruta = `/panel/usuarios?skip=${skip}&limit=${LIMITE}${q ? `&q=${encodeURIComponent(q)}` : ""}${estado ? `&estado=${estado}` : ""}`
  const { datos, error, recargar } = useLista<Lista>(ruta)

  return (
    <section className="flex flex-col gap-3" aria-label="Usuarios">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Buscar usuario" value={q} onChange={(e) => { setQ(e.target.value); setSkip(0) }} placeholder="Buscar por correo o usuario" className={`${entrada} max-w-xs`} />
        <select aria-label="Filtrar por estado" value={estado} onChange={(e) => { setEstado(e.target.value); setSkip(0) }} className={`${entrada} max-w-[11rem]`}>
          <option value="">Todos</option><option value="activos">Activos</option><option value="suspendidos">Suspendidos</option><option value="admins">Administradores</option>
        </select>
        <button type="button" className={`${botonPrimario} ml-auto`} onClick={() => setEditando("nuevo")}>+ Nuevo usuario</button>
      </div>
      {error && <ErrorCarga mensaje={error} />}
      <div className={tarjeta}>
        <Tabla columnas={["Usuario", "Estado", "Procesos", "Celulares", "Último acceso", "Acciones"]} vacio={datos && datos.usuarios.length === 0 ? "Sin resultados" : undefined}>
          {datos?.usuarios.map((u) => (
            <tr key={u.id}>
              <td className="px-3 py-2.5"><p className="font-semibold text-slate-800">{u.username || "—"}</p><p className="text-xs text-slate-500">{u.email}</p></td>
              <td className="px-3 py-2.5 space-x-1">{u.activo ? <Insignia tono="verde">Activo</Insignia> : <Insignia tono="rojo">Suspendido</Insignia>}{u.es_admin && <Insignia tono="indigo">Admin</Insignia>}</td>
              <td className="px-3 py-2.5">{u.procesos}</td>
              <td className="px-3 py-2.5">{u.dispositivos}</td>
              <td className="px-3 py-2.5 text-xs text-slate-600">{fecha(u.ultimo_acceso)}</td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={botonMini} onClick={() => setEditando(u)}>Editar</button>
                  <button type="button" className={botonMini} disabled={u.id === yoId} onClick={() => accion(apiJson(`/panel/usuarios/${u.id}`, { method: "PATCH", body: { activo: !u.activo } }), u.activo ? "Usuario suspendido" : "Usuario reactivado", recargar)}>{u.activo ? "Suspender" : "Reactivar"}</button>
                  <button type="button" className={botonMini} onClick={() => accion(apiJson(`/panel/usuarios/${u.id}/enviar-reset`, { method: "POST" }), "Enlace de contraseña enviado", recargar)}>Enviar enlace</button>
                  <button type="button" className={botonMini} onClick={() => accion(apiJson(`/panel/usuarios/${u.id}/cerrar-sesiones`, { method: "POST" }), "Sesiones cerradas", recargar)}>Cerrar sesiones</button>
                  <button type="button" className={`${botonMini} !border-rose-200 !text-rose-600`} disabled={u.id === yoId} onClick={() => setAEliminar(u)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
        </Tabla>
        {datos && <Paginador total={datos.total} skip={skip} onCambio={setSkip} />}
      </div>

      {editando && <FormUsuario usuario={editando === "nuevo" ? undefined : editando} onCerrar={() => setEditando(null)} onGuardado={recargar} />}
      {aEliminar && (
        <Confirmar
          titulo="¿Eliminar este usuario?"
          textoBoton="Sí, eliminar"
          mensaje={<><p className="font-semibold text-slate-800">{aEliminar.email}</p><p className="mt-2">Se borrarán también sus {aEliminar.procesos} proceso(s), actuaciones y celulares. No se puede deshacer.</p></>}
          onCerrar={() => setAEliminar(null)}
          onConfirmar={() => { const u = aEliminar; setAEliminar(null); void accion(apiJson(`/panel/usuarios/${u.id}`, { method: "DELETE" }), "Usuario eliminado", recargar) }}
        />
      )}
    </section>
  )
}

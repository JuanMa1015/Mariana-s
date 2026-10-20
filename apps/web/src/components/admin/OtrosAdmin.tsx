import { useState } from "react"
import { apiJson } from "../../api"
import { accion, botonMini, botonPrimario, ErrorCarga, fecha, Insignia, LIMITE, Paginador, Tabla, tarjeta, useLista } from "./comunes"

// ── Resumen ────────────────────────────────────────────────────────────────
interface Resumen {
  usuarios: { total: number; activos: number; admins: number; nuevos_7d: number }
  procesos: { total: number; con_novedad: number; sin_sincronizar_24h: number; con_fallos: number; aviso_pendiente: number }
  dispositivos: number
  ultima_sincronizacion: string | null
  integraciones: { correo: string[]; telegram: boolean; push: boolean; api_token: boolean; admins_por_correo: number }
}

function Dato({ titulo, valor, tono }: { titulo: string; valor: number | string; tono?: "ambar" | "rojo" }) {
  const color = tono === "rojo" ? "text-rose-600" : tono === "ambar" ? "text-amber-600" : "text-slate-900"
  return (
    <div className={tarjeta}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className={`mt-1 text-3xl font-black tracking-tight ${color}`}>{valor}</p>
    </div>
  )
}

export function ResumenAdmin({ irAPruebas }: { irAPruebas: () => void }) {
  const { datos: r, error } = useLista<Resumen>("/panel/resumen")
  if (error) return <ErrorCarga mensaje={error} />
  if (!r) return <p className="text-sm text-slate-500">Cargando…</p>
  const i = r.integraciones
  return (
    <section className="flex flex-col gap-4" aria-label="Resumen">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato titulo="Usuarios" valor={r.usuarios.total} />
        <Dato titulo="Nuevos (7 días)" valor={r.usuarios.nuevos_7d} />
        <Dato titulo="Procesos" valor={r.procesos.total} />
        <Dato titulo="Celulares con push" valor={r.dispositivos} />
        <Dato titulo="Con novedad" valor={r.procesos.con_novedad} tono={r.procesos.con_novedad ? "ambar" : undefined} />
        <Dato titulo="Sin sync en 24 h" valor={r.procesos.sin_sincronizar_24h} tono={r.procesos.sin_sincronizar_24h ? "ambar" : undefined} />
        <Dato titulo="Con fallos de sync" valor={r.procesos.con_fallos} tono={r.procesos.con_fallos ? "rojo" : undefined} />
        <Dato titulo="Avisos sin entregar" valor={r.procesos.aviso_pendiente} tono={r.procesos.aviso_pendiente ? "rojo" : undefined} />
      </div>
      <div className={tarjeta}>
        <h2 className="text-sm font-bold text-slate-800">Integraciones</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Insignia tono={i.correo.length ? "verde" : "rojo"}>Correo: {i.correo.join(", ") || "sin proveedor"}</Insignia>
          <Insignia tono={i.telegram ? "verde" : "gris"}>Telegram {i.telegram ? "activo" : "sin configurar"}</Insignia>
          <Insignia tono={i.push ? "verde" : "gris"}>Push {i.push ? "activo" : "sin configurar"}</Insignia>
          <Insignia tono={i.api_token ? "verde" : "ambar"}>API_TOKEN {i.api_token ? "configurado" : "falta"}</Insignia>
          <Insignia tono="indigo">{r.usuarios.admins} admin(s) en BD · {i.admins_por_correo} por correo</Insignia>
        </div>
        <p className="mt-3 text-xs text-slate-500">Última sincronización: {fecha(r.ultima_sincronizacion)}</p>
        <button type="button" onClick={irAPruebas} className={`${botonPrimario} mt-3`}>Ir a pruebas y diagnóstico</button>
      </div>
    </section>
  )
}

// ── Dispositivos ───────────────────────────────────────────────────────────
interface Dispositivo { id: number; usuario_email: string; plataforma: string; token: string; creado_en: string | null; ultimo_uso: string | null }

export function DispositivosAdmin() {
  const [skip, setSkip] = useState(0)
  const { datos, error, recargar } = useLista<{ total: number; dispositivos: Dispositivo[] }>(`/panel/dispositivos?skip=${skip}&limit=${LIMITE}`)
  return (
    <section className="flex flex-col gap-3" aria-label="Dispositivos">
      <p className="text-sm text-slate-600">Celulares registrados para recibir notificaciones push. El token completo no se muestra.</p>
      {error && <ErrorCarga mensaje={error} />}
      <div className={tarjeta}>
        <Tabla columnas={["Usuario", "Plataforma", "Token", "Registrado", "Acciones"]} vacio={datos && datos.dispositivos.length === 0 ? "Ningún celular registrado todavía" : undefined}>
          {datos?.dispositivos.map((d) => (
            <tr key={d.id}>
              <td className="px-3 py-2.5 text-xs text-slate-700">{d.usuario_email}</td>
              <td className="px-3 py-2.5"><Insignia>{d.plataforma}</Insignia></td>
              <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{d.token}</td>
              <td className="px-3 py-2.5 text-xs text-slate-600">{fecha(d.creado_en)}</td>
              <td className="px-3 py-2.5"><button type="button" className={`${botonMini} !border-rose-200 !text-rose-600`} onClick={() => accion(apiJson(`/panel/dispositivos/${d.id}`, { method: "DELETE" }), "Dispositivo eliminado", recargar)}>Eliminar</button></td>
            </tr>
          ))}
        </Tabla>
        {datos && <Paginador total={datos.total} skip={skip} onCambio={setSkip} />}
      </div>
    </section>
  )
}

// ── Auditoría ──────────────────────────────────────────────────────────────
interface Registro { id: number; admin: string; accion: string; objetivo: string | null; detalle: string | null; creado_en: string | null }

export function AuditoriaAdmin() {
  const [skip, setSkip] = useState(0)
  const { datos, error } = useLista<{ total: number; registros: Registro[] }>(`/panel/auditoria?skip=${skip}&limit=50`)
  return (
    <section className="flex flex-col gap-3" aria-label="Auditoría">
      <p className="text-sm text-slate-600">Qué hicieron los administradores desde el panel: quién, qué y sobre qué.</p>
      {error && <ErrorCarga mensaje={error} />}
      <div className={tarjeta}>
        <Tabla columnas={["Cuándo", "Admin", "Acción", "Sobre", "Detalle"]} vacio={datos && datos.registros.length === 0 ? "Aún no hay actividad registrada" : undefined}>
          {datos?.registros.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{fecha(r.creado_en)}</td>
              <td className="px-3 py-2.5 text-xs text-slate-700">{r.admin}</td>
              <td className="px-3 py-2.5"><Insignia tono="indigo">{r.accion}</Insignia></td>
              <td className="max-w-[14rem] truncate px-3 py-2.5 text-xs text-slate-700">{r.objetivo || "—"}</td>
              <td className="max-w-[18rem] truncate px-3 py-2.5 text-xs text-slate-500" title={r.detalle ?? undefined}>{r.detalle || "—"}</td>
            </tr>
          ))}
        </Tabla>
        {datos && <Paginador total={datos.total} skip={skip} limit={50} onCambio={setSkip} />}
      </div>
    </section>
  )
}

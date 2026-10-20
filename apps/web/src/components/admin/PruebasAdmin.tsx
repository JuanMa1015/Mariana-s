import { useState } from "react"
import toast from "react-hot-toast"
import { apiJson } from "../../api"
import { botonPrimario, botonSecundario, entrada, ErrorCarga, etiqueta, Insignia, tarjeta, useLista } from "./comunes"
import type { UsuarioAdmin } from "./UsuariosAdmin"

interface Parametro { nombre: string; tipo: "texto" | "email" | "numero" | "usuario"; etiqueta: string; defecto: string | number }
interface Prueba { id: string; nombre: string; descripcion: string; parametros: Parametro[] }
interface Paso { estado: "ok" | "aviso" | "fallo"; nombre: string; detalle: string }
interface Resultado { id: string; nombre: string; estado: "ok" | "aviso" | "fallo"; resumen: string; pasos: Paso[]; ms: number }

const ICONO = { ok: "✓", aviso: "!", fallo: "✕" }
const COLOR = { ok: "text-emerald-600", aviso: "text-amber-600", fallo: "text-rose-600" }
const TONO = { ok: "verde", aviso: "ambar", fallo: "rojo" } as const
const ETIQUETA = { ok: "Correcta", aviso: "Con avisos", fallo: "Con fallos" }

function ResultadoPrueba({ r }: { r: Resultado }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3" role="status" aria-label={`Resultado de ${r.nombre}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Insignia tono={TONO[r.estado]}>{ETIQUETA[r.estado]}</Insignia>
        <span className="text-xs text-slate-600">{r.resumen} · {r.ms} ms</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {r.pasos.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className={`w-4 shrink-0 text-center font-bold ${COLOR[p.estado]}`} aria-label={p.estado}>{ICONO[p.estado]}</span>
            <span><span className="font-medium text-slate-800">{p.nombre}</span>{p.detalle && <span className="text-slate-600"> — {p.detalle}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PruebasAdmin() {
  const catalogo = useLista<{ pruebas: Prueba[] }>("/panel/pruebas")
  const usuarios = useLista<{ usuarios: UsuarioAdmin[] }>("/panel/usuarios?limit=100")
  // Solo lo que el admin cambió; lo demás sale del valor por defecto del catálogo
  const [ediciones, setEdiciones] = useState<Record<string, Record<string, string | number>>>({})
  const [resultados, setResultados] = useState<Record<string, Resultado>>({})
  const [ejecutando, setEjecutando] = useState<Set<string>>(new Set())
  const [estadoTodas, setEstadoTodas] = useState<Resultado["estado"] | null>(null)

  const valoresDe = (p: Prueba) => Object.fromEntries(p.parametros.map((q) => [q.nombre, ediciones[p.id]?.[q.nombre] ?? q.defecto]))

  const marcar = (id: string, en: boolean) => setEjecutando((s) => { const n = new Set(s); if (en) n.add(id); else n.delete(id); return n })

  const ejecutar = async (p: Prueba) => {
    marcar(p.id, true)
    try {
      const r = await apiJson<Resultado>(`/panel/pruebas/${p.id}`, { method: "POST", body: { parametros: valoresDe(p) } })
      setResultados((x) => ({ ...x, [p.id]: r }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo ejecutar la prueba")
    } finally {
      marcar(p.id, false)
    }
  }

  const ejecutarTodas = async () => {
    marcar("todas", true)
    try {
      const r = await apiJson<{ estado: Resultado["estado"]; resultados: Resultado[] }>("/panel/pruebas/todas", { method: "POST" })
      setResultados(Object.fromEntries(r.resultados.map((x) => [x.id, x])))
      setEstadoTodas(r.estado)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron ejecutar las pruebas")
    } finally {
      marcar("todas", false)
    }
  }

  const poner = (pid: string, nombre: string, valor: string | number) => setEdiciones((v) => ({ ...v, [pid]: { ...v[pid], [nombre]: valor } }))

  if (catalogo.error) return <ErrorCarga mensaje={catalogo.error} />

  return (
    <section className="flex flex-col gap-4" aria-label="Pruebas y diagnóstico">
      <div className={`${tarjeta} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Diagnóstico rápido</h2>
          <p className="mt-1 text-sm text-slate-600">Corre todas las pruebas en modo seguro: no envía correos, push ni mensajes reales.</p>
          {estadoTodas && <div className="mt-2"><Insignia tono={TONO[estadoTodas]}>Resultado general: {ETIQUETA[estadoTodas].toLowerCase()}</Insignia></div>}
        </div>
        <button type="button" onClick={ejecutarTodas} disabled={ejecutando.has("todas")} className={botonPrimario}>{ejecutando.has("todas") ? "Ejecutando…" : "Ejecutar todas"}</button>
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Las pruebas de registro, ingreso, restablecer contraseña y radicados crean una cuenta temporal <span className="font-mono">qa-…@example.com</span> y la borran al terminar. Nunca tocan cuentas reales.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {catalogo.datos?.pruebas.map((p) => (
          <article key={p.id} className={tarjeta}>
            <h3 className="text-sm font-bold text-slate-800">{p.nombre}</h3>
            <p className="mt-1 text-sm text-slate-600">{p.descripcion}</p>
            {p.parametros.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {p.parametros.map((q) => {
                  const id = `${p.id}-${q.nombre}`
                  const valor = ediciones[p.id]?.[q.nombre] ?? q.defecto
                  return (
                    <div key={q.nombre}>
                      <label htmlFor={id} className={etiqueta}>{q.etiqueta}</label>
                      {q.tipo === "usuario" ? (
                        <select id={id} value={valor} onChange={(e) => poner(p.id, q.nombre, Number(e.target.value))} className={entrada}>
                          {usuarios.datos?.usuarios.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
                        </select>
                      ) : (
                        <input id={id} type={q.tipo === "numero" ? "number" : q.tipo === "email" ? "email" : "text"} min={q.tipo === "numero" ? 0 : undefined} max={q.tipo === "numero" ? 60 : undefined} value={valor} onChange={(e) => poner(p.id, q.nombre, q.tipo === "numero" ? Number(e.target.value) : e.target.value)} className={entrada} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-3">
              <button type="button" onClick={() => ejecutar(p)} disabled={ejecutando.has(p.id)} className={botonSecundario}>{ejecutando.has(p.id) ? "Ejecutando…" : `Ejecutar «${p.nombre}»`}</button>
            </div>
            {resultados[p.id] && <ResultadoPrueba r={resultados[p.id]} />}
          </article>
        ))}
      </div>
    </section>
  )
}

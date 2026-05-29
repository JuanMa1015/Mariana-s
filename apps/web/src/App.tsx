import { useState, useEffect } from "react"
import { getProcesos, getNovedades, postSync } from "./api"
import type { ListaProcesos, ListaNovedades, ResultadoSync } from "./types"
import TarjetaResumen from "./components/TarjetaResumen"
import TablaProcesos from "./components/TablaProcesos"

export default function App() {
  const [procesos, setProcesos] = useState<ListaProcesos | null>(null)
  const [novedades, setNovedades] = useState<ListaNovedades | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [ultimoSync, setUltimoSync] = useState<ResultadoSync | null>(null)
  const [filtroDespacho, setFiltroDespacho] = useState("")
  const [filtroDepartamento, setFiltroDepartamento] = useState("")

  const cargarDatos = async () => {
    const [p, n] = await Promise.all([
      getProcesos(filtroDespacho, filtroDepartamento),
      getNovedades(),
    ])
    setProcesos(p)
    setNovedades(n)
  }

  useEffect(() => {
    cargarDatos()
  }, [filtroDespacho, filtroDepartamento])

  const handleSync = async () => {
    setSyncing(true)
    const resultado = await postSync()
    setUltimoSync(resultado)
    await cargarDatos()
    setSyncing(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mariana's</h1>
          <p className="text-sm text-gray-500">Monitor de Procesos Judiciales</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2 rounded-xl font-medium transition"
        >
          {syncing ? "Sincronizando..." : "Sincronizar ahora"}
        </button>
      </header>

      <main className="px-8 py-6 space-y-6">
        {/* Resultado último sync */}
        {ultimoSync && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-800">
            Último sync — Consultados: <strong>{ultimoSync.total_consultados}</strong> |
            Nuevos: <strong>{ultimoSync.nuevos}</strong> |
            Actualizados: <strong>{ultimoSync.actualizados}</strong>
          </div>
        )}

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TarjetaResumen
            titulo="Total procesos guardados"
            valor={procesos?.total ?? 0}
            color="bg-blue-600"
          />
          <TarjetaResumen
            titulo="Novedades sin revisar"
            valor={novedades?.total ?? 0}
            color="bg-yellow-500"
          />
          <TarjetaResumen
            titulo="Procesos al día"
            valor={(procesos?.total ?? 0) - (novedades?.total ?? 0)}
            color="bg-green-600"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Filtrar por despacho..."
            value={filtroDespacho}
            onChange={(e) => setFiltroDespacho(e.target.value)}
            className="border rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <input
            type="text"
            placeholder="Filtrar por departamento..."
            value={filtroDepartamento}
            onChange={(e) => setFiltroDepartamento(e.target.value)}
            className="border rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Tabla */}
        {procesos && <TablaProcesos procesos={procesos.procesos} />}
      </main>
    </div>
  )
}
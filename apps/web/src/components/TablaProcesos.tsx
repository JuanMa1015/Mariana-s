import type { Proceso } from "../types"

interface Props {
  procesos: Proceso[]
}

export default function TablaProcesos({ procesos }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl shadow">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
          <tr>
            <th className="px-4 py-3">Radicado</th>
            <th className="px-4 py-3">Despacho</th>
            <th className="px-4 py-3">Departamento</th>
            <th className="px-4 py-3">Sujetos</th>
            <th className="px-4 py-3">Última actuación</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {procesos.map((p) => (
            <tr key={p.llave_proceso} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs">{p.llave_proceso}</td>
              <td className="px-4 py-3">{p.despacho}</td>
              <td className="px-4 py-3">{p.departamento}</td>
              <td className="px-4 py-3 max-w-xs truncate">{p.sujetos_procesales}</td>
              <td className="px-4 py-3">
                {p.fecha_ultima_actuacion
                  ? new Date(p.fecha_ultima_actuacion).toLocaleDateString("es-CO")
                  : "—"}
              </td>
              <td className="px-4 py-3">
                {p.notificado ? (
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">Al día</span>
                ) : (
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">Novedad</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
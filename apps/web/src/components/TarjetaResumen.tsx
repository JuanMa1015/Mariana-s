interface Props {
  titulo: string
  valor: number
  color: string
}

export default function TarjetaResumen({ titulo, valor, color }: Props) {
  return (
    <div className={`rounded-2xl p-6 text-white shadow-md ${color}`}>
      <p className="text-sm font-medium opacity-80">{titulo}</p>
      <p className="text-4xl font-bold mt-1">{valor}</p>
    </div>
  )
}
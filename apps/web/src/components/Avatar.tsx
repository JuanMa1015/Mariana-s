interface Props {
  nombre: string
  url?: string | null
  /** Clases de tamaño de Tailwind, p. ej. "h-9 w-9" */
  tamano?: string
}

/** Foto de perfil redonda; si no hay, las iniciales sobre el color de marca. */
export default function Avatar({ nombre, url, tamano = "h-9 w-9" }: Props) {
  const iniciales = nombre.trim().slice(0, 2).toUpperCase() || "?"
  return url ? (
    <img src={url} alt="" className={`${tamano} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${tamano} grid shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white`}
    >
      {iniciales}
    </span>
  )
}

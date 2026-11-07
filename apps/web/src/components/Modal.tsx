import { useEffect, useId, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

interface Props {
  titulo: string
  onClose: () => void
  children: ReactNode
  /** "alertdialog" para confirmaciones de acciones destructivas */
  role?: "dialog" | "alertdialog"
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'

/** Diálogo accesible: Esc cierra, foco atrapado y devuelto al elemento que lo abrió. */
export default function Modal({ titulo, onClose, children, role = "dialog" }: Props) {
  const tituloId = useId()
  const ref = useRef<HTMLDivElement>(null)
  // onClose en ref: si el padre pasa una función nueva en cada render, el foco no se reinicia.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    const cont = ref.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const fondo = Array.from(document.body.children)
      .filter((el): el is HTMLElement => el instanceof HTMLElement && !el.contains(cont))
      .map((el) => ({ el, inert: el.inert }))
    for (const { el } of fondo) el.inert = true
    // En confirmaciones el foco inicial va al último botón (Cancelar), la opción segura.
    const items = cont?.querySelectorAll<HTMLElement>(FOCUSABLE)
    const inicial = role === "alertdialog" ? items?.[items.length - 1] : items?.[0]
    ;(inicial ?? cont)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onCloseRef.current()
      } else if (e.key === "Tab" && cont) {
        const f = cont.querySelectorAll<HTMLElement>(FOCUSABLE)
        if (!f.length) return
        const primero = f[0]
        const ultimo = f[f.length - 1]
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault()
          ultimo.focus()
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault()
          primero.focus()
        }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
      for (const { el, inert } of fondo) el.inert = inert
      previo?.focus?.()
    }
  }, [role])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={tituloId} className="mb-4 text-lg font-bold text-slate-800">{titulo}</h3>
        {children}
      </div>
    </div>,
    document.body,
  )
}

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("../api", () => ({ deleteProceso: vi.fn(), updateProceso: vi.fn() }))

type ToastArgs = { id: string; visible: boolean; type: string }
type ToastRender = (t: ToastArgs) => ReactNode
const toastFn = Object.assign(vi.fn<(content: ToastRender, opts?: object) => string>(() => "toast-id"), {
  loading: vi.fn(() => "tid"),
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
})
vi.mock("react-hot-toast", () => ({ default: toastFn }))

const PROCESOS_MOCK = [
  {
    llave_proceso: "05001310301720240048000",
    despacho: "Juzgado 17 Civil del Circuito",
    departamento: "Antioquia",
    categoria: "Trabajo",
    sujetos_procesales: "DEMANDANTE: Pérez\nDEMANDADO: Empresa SAS",
    tipo_proceso: "VERBAL",
    clase_proceso: "Ordinario",
    es_privado: false,
    fecha_proceso: "2024-01-15T00:00:00Z",
    fecha_ultima_actuacion: "2026-06-15T10:00:00Z",
    notificado: false,
    creado_en: "2024-02-01T00:00:00Z",
    actualizado_en: "2026-06-15T12:00:00Z",
  },
  {
    llave_proceso: "05001400300520230010000",
    despacho: "Juzgado 5 Civil Municipal",
    departamento: "Antioquia",
    categoria: "Consultorio",
    sujetos_procesales: "DEMANDANTE: Otro",
    tipo_proceso: "EJECUTIVO",
    clase_proceso: "Ordinario",
    es_privado: false,
    fecha_proceso: "2023-06-01T00:00:00Z",
    fecha_ultima_actuacion: "2026-06-10T00:00:00Z",
    notificado: true,
    creado_en: "2023-06-02T00:00:00Z",
    actualizado_en: "2026-06-10T12:00:00Z",
  },
]

const onOpenDetalle = vi.fn()
const onDelete = vi.fn()

beforeEach(async () => {
  vi.clearAllMocks()
})

describe("TablaProcesos", () => {
  it("debe renderizar la lista de procesos", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    expect(screen.getByText("05001 31 03 017 2024 00480 00")).toBeInTheDocument()
    expect(screen.getByText("05001 40 03 005 2023 00100 00")).toBeInTheDocument()
  })

  it("debe mostrar nombres de despacho", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    expect(screen.getByText(/Juzgado 17 Civil/i)).toBeInTheDocument()
    expect(screen.getByText(/Juzgado 5 Civil/i)).toBeInTheDocument()
  })

  it("debe mostrar categorías según el proceso", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    expect(screen.getByText("Trabajo")).toBeInTheDocument()
    expect(screen.getByText("Consultorio")).toBeInTheDocument()
  })

  it("debe mostrar estado Con novedad y Al día", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    expect(screen.getByText("Con novedad")).toBeInTheDocument()
    expect(screen.getByText("Al día")).toBeInTheDocument()
  })

  it("debe expandir fila al hacer clic y mostrar detalle", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    fireEvent.click(screen.getByText("05001 31 03 017 2024 00480 00"))
    await waitFor(() => {
      expect(screen.getByText("VERBAL")).toBeInTheDocument()
    })
  })

  it("debe mostrar botón Detalle que llama onOpenDetalle", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    const detailButtons = screen.getAllByText("Detalle")
    fireEvent.click(detailButtons[0])
    expect(onOpenDetalle).toHaveBeenCalledWith("05001310301720240048000")
  })

  it("debe pedir confirmación en un diálogo al eliminar", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    fireEvent.click(screen.getAllByTitle("Eliminar radicado")[0])
    expect(screen.getByRole("alertdialog", { name: "¿Eliminar este radicado?" })).toBeInTheDocument()
  })

  it("debe eliminar al confirmar en el diálogo", async () => {
    const { deleteProceso } = await import("../api")
    vi.mocked(deleteProceso).mockResolvedValue({ deleted: true })

    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} onDelete={onDelete} />
      </div>,
    )

    fireEvent.click(screen.getAllByTitle("Eliminar radicado")[0])
    fireEvent.click(screen.getByText("Sí, eliminar"))

    await waitFor(() => {
      expect(deleteProceso).toHaveBeenCalledWith("05001310301720240048000")
    })
    expect(toastFn.success).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledWith("05001310301720240048000")
  })

  it("debe cerrar el diálogo con Cancelar y con Escape sin eliminar", async () => {
    const { deleteProceso } = await import("../api")
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )

    fireEvent.click(screen.getAllByTitle("Eliminar radicado")[0])
    fireEvent.click(screen.getByText("Cancelar"))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByTitle("Eliminar radicado")[0])
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(deleteProceso).not.toHaveBeenCalled()
  })

  it("no debe permitir guardar un radicado de menos de 23 dígitos", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    fireEvent.click(screen.getAllByTitle("Editar radicado")[0])
    const input = screen.getByLabelText(/Radicado \(23 dígitos\)/)
    fireEvent.change(input, { target: { value: "123" } })
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  it("debe pedir al servidor el orden elegido", async () => {
    const onOrden = vi.fn()
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} orden="novedad" onOrden={onOrden} />
      </div>,
    )
    fireEvent.change(screen.getByLabelText("Ordenar"), { target: { value: "antigua" } })
    expect(onOrden).toHaveBeenCalledWith("antigua")
  })

  it("debe mostrar y enviar el alias al editar", async () => {
    const { updateProceso } = await import("../api")
    vi.mocked(updateProceso).mockResolvedValue({ updated: true })
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    fireEvent.click(screen.getAllByTitle("Editar radicado")[0])
    fireEvent.change(screen.getByLabelText(/Cliente o alias/), { target: { value: "  Pérez  " } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => {
      expect(updateProceso).toHaveBeenCalledWith("05001310301720240048000", expect.objectContaining({ alias: "Pérez" }))
    })
  })

  it("debe mostrar guía cuando no hay procesos", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(<TablaProcesos procesos={[]} onOpenDetalle={onOpenDetalle} />)
    expect(screen.getByText("Aún no tienes procesos guardados")).toBeInTheDocument()
  })
})

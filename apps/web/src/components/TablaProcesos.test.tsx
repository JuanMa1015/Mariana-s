import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

vi.mock("../api", () => ({ deleteProceso: vi.fn(), updateProceso: vi.fn() }))

let toastRenderContent: ((t: any) => ReactNode) | null = null
const toastFn = vi.fn((content: any) => {
  toastRenderContent = content
  return "toast-id"
}) as any
toastFn.loading = vi.fn(() => "tid")
toastFn.success = vi.fn()
toastFn.error = vi.fn()
toastFn.dismiss = vi.fn()
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
  toastRenderContent = null
})

describe("TablaProcesos", () => {
  it("debe renderizar la lista de procesos", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    expect(screen.getByText("05001310301720240048000")).toBeInTheDocument()
    expect(screen.getByText("05001400300520230010000")).toBeInTheDocument()
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

  it("debe mostrar estado Pendiente y Vigente", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    expect(screen.getByText("Pendiente")).toBeInTheDocument()
    expect(screen.getByText("Vigente")).toBeInTheDocument()
  })

  it("debe expandir fila al hacer clic y mostrar detalle", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    fireEvent.click(screen.getByText("05001310301720240048000"))
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

  it("debe mostrar toast de confirmación al eliminar", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )
    fireEvent.click(screen.getAllByTitle("Eliminar radicado")[0])
    expect(toastFn).toHaveBeenCalled()
  })

  it("debe eliminar al confirmar en el toast", async () => {
    const { deleteProceso } = await import("../api")
    vi.mocked(deleteProceso).mockResolvedValue({ deleted: true })

    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} onDelete={onDelete} />
      </div>,
    )

    fireEvent.click(screen.getAllByTitle("Eliminar radicado")[0])

    const contentFn = toastFn.mock.calls[0][0]
    const toastArgs = { id: "test-id", visible: true, type: "custom" as const }
    render(<div>{contentFn(toastArgs)}</div>, { container: document.body })

    fireEvent.click(screen.getByText("Sí, eliminar"))

    await waitFor(() => {
      expect(deleteProceso).toHaveBeenCalledWith("05001310301720240048000")
    })
    expect(toastFn.success).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledWith("05001310301720240048000")
  })

  it("debe cerrar toast al cancelar eliminación", async () => {
    const { default: TablaProcesos } = await import("./TablaProcesos")
    render(
      <div style={{ height: 500 }}>
        <TablaProcesos procesos={PROCESOS_MOCK} onOpenDetalle={onOpenDetalle} />
      </div>,
    )

    fireEvent.click(screen.getAllByTitle("Eliminar radicado")[0])

    const contentFn = toastFn.mock.calls[0][0]
    const toastArgs = { id: "test-id", visible: true, type: "custom" as const }
    render(<div>{contentFn(toastArgs)}</div>, { container: document.body })

    fireEvent.click(screen.getByText("Cancelar"))
    expect(toastFn.dismiss).toHaveBeenCalledWith("test-id")
  })
})

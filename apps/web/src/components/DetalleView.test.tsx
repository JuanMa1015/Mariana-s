import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("../api", () => ({ updateProceso: vi.fn() }))

const mockToast = { loading: vi.fn(() => "tid"), success: vi.fn(), error: vi.fn() }
vi.mock("react-hot-toast", () => ({ default: mockToast }))

const DETALLE_MOCK = {
  llave_proceso: "05001310301720240048000",
  notificado: false,
  despacho: "Juzgado 17 Civil del Circuito",
  departamento: "Antioquia",
  categoria: "Trabajo",
  es_privado: false,
  sujetos_procesales: "DEMANDANTE: Pérez\nDEMANDADO: Empresa SAS",
  fecha_proceso: "2024-01-15T00:00:00Z",
  fecha_ultima_actuacion: "2026-06-15T10:00:00Z",
  creado_en: "2024-02-01T00:00:00Z",
  actualizado_en: "2026-06-15T12:00:00Z",
  tipo_proceso: "VERBAL",
  clase_proceso: "Ordinario",
  actuaciones: [
    {
      id_reg_actuacion: 3,
      cons_actuacion: 3,
      fecha_actuacion: "2026-06-15T10:00:00Z",
      actuacion: "Auto admite demanda",
      anotacion: "Se admite la demanda",
      fecha_inicial: null,
      fecha_final: null,
      fecha_registro: "2026-06-15T10:00:00Z",
      con_documentos: true,
      documentos: [
        { id_reg_documento: 1, nombre: "auto.pdf", descripcion: "Auto", fecha_carga: "2026-06-15T10:00:00Z", guid_documento_sxxiw: "guid-1" },
      ],
    },
    {
      id_reg_actuacion: 2,
      cons_actuacion: 2,
      fecha_actuacion: "2026-05-01T00:00:00Z",
      actuacion: "Presenta demanda",
      anotacion: null,
      fecha_inicial: null,
      fecha_final: null,
      fecha_registro: "2026-05-01T00:00:00Z",
      con_documentos: false,
      documentos: [],
    },
  ],
}

const onVolver = vi.fn()
const onActualizado = vi.fn()

beforeEach(async () => {
  vi.clearAllMocks()
})

describe("DetalleView", () => {
  it("debe renderizar el radicado y datos principales", async () => {
    const { default: DetalleView } = await import("./DetalleView")
    render(<DetalleView detalle={DETALLE_MOCK} onVolver={onVolver} />)
    expect(screen.getByText("05001310301720240048000")).toBeInTheDocument()
    expect(screen.getByText(/Juzgado 17 Civil/i)).toBeInTheDocument()
    expect(screen.getByText("Antioquia")).toBeInTheDocument()
    expect(screen.getAllByText("Trabajo").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("VERBAL")).toBeInTheDocument()
    expect(screen.getByText("Ordinario")).toBeInTheDocument()
  })

  it("debe mostrar 'Pendiente de revisión' cuando notificado es false", async () => {
    const { default: DetalleView } = await import("./DetalleView")
    render(<DetalleView detalle={DETALLE_MOCK} onVolver={onVolver} />)
    expect(screen.getByText("Pendiente de revisión")).toBeInTheDocument()
  })

  it("debe mostrar 'Vigente' cuando notificado es true", async () => {
    const { default: DetalleView } = await import("./DetalleView")
    render(<DetalleView detalle={{ ...DETALLE_MOCK, notificado: true }} onVolver={onVolver} />)
    expect(screen.getByText("Vigente")).toBeInTheDocument()
  })

  it("debe llamar onVolver al hacer clic en Volver", async () => {
    const { default: DetalleView } = await import("./DetalleView")
    render(<DetalleView detalle={DETALLE_MOCK} onVolver={onVolver} />)
    fireEvent.click(screen.getByText("Volver"))
    expect(onVolver).toHaveBeenCalled()
  })

  it("debe mostrar las actuaciones en timeline", async () => {
    const { default: DetalleView } = await import("./DetalleView")
    render(<DetalleView detalle={DETALLE_MOCK} onVolver={onVolver} />)
    expect(screen.getByText("Auto admite demanda")).toBeInTheDocument()
    expect(screen.getByText("Presenta demanda")).toBeInTheDocument()
  })

  it("debe mostrar sujetos procesales", async () => {
    const { default: DetalleView } = await import("./DetalleView")
    render(<DetalleView detalle={DETALLE_MOCK} onVolver={onVolver} />)
    expect(screen.getByText(/DEMANDANTE: Pérez/)).toBeInTheDocument()
    expect(screen.getByText(/DEMANDADO: Empresa SAS/)).toBeInTheDocument()
  })

  it("debe llamar updateProceso al marcar como leído", async () => {
    const { default: DetalleView } = await import("./DetalleView")
    const { updateProceso } = await import("../api")
    vi.mocked(updateProceso).mockResolvedValue({})

    render(<DetalleView detalle={DETALLE_MOCK} onVolver={onVolver} onActualizado={onActualizado} />)
    fireEvent.click(screen.getByText(/marcar como leído/i))

    await waitFor(() => {
      expect(updateProceso).toHaveBeenCalledWith("05001310301720240048000", { notificado: true })
    })
    expect(mockToast.success).toHaveBeenCalled()
    expect(onActualizado).toHaveBeenCalled()
  })

  it("debe mostrar documentos en actuación al expandir", async () => {
    const { default: DetalleView } = await import("./DetalleView")
    render(<DetalleView detalle={DETALLE_MOCK} onVolver={onVolver} />)
    const docToggle = screen.getByText(/1 documento/i)
    fireEvent.click(docToggle)
    await waitFor(() => {
      expect(screen.getByText("auto.pdf")).toBeInTheDocument()
    })
  })
})

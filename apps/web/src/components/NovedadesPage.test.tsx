import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock("../api", () => ({ getNovedadesDetalle: vi.fn() }))

const NOVEDADES_MOCK = {
  total: 2,
  novedades: [
    {
      llave_proceso: "05001310301720240048000",
      despacho: "Juzgado 17 Civil del Circuito",
      departamento: "Antioquia",
      categoria: "Trabajo",
      sujetos_procesales: "DEMANDANTE: Pérez\nDEMANDADO: Empresa SAS",
      fecha_ultima_actuacion: "2026-06-15T10:00:00Z",
      tipo_novedad: "actualizacion",
      actuaciones: [
        {
          id_reg_actuacion: 1,
          cons_actuacion: 1,
          fecha_actuacion: "2026-06-15T10:00:00Z",
          actuacion: "Auto admite demanda",
          anotacion: "Se admite la demanda",
          fecha_inicial: null,
          fecha_final: null,
          fecha_registro: "2026-06-15T10:00:00Z",
          con_documentos: false,
          documentos: [],
        },
      ],
    },
    {
      llave_proceso: "05001400300520230010000",
      despacho: "Juzgado 5 Civil Municipal",
      departamento: "Antioquia",
      categoria: "Consultorio",
      sujetos_procesales: "DEMANDANTE: Otro",
      fecha_ultima_actuacion: "2026-06-14T08:00:00Z",
      tipo_novedad: "nuevo",
      actuaciones: [],
    },
  ],
}

beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.setItem("token", "test-token")
})

describe("NovedadesPage", () => {
  it("debe mostrar spinner mientras carga", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockReturnValue(new Promise(() => {}))
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    expect(screen.getByText(/cargando novedades/i)).toBeInTheDocument()
  })

  it("debe mostrar 'todo al día' cuando no hay novedades", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({ total: 0, novedades: [] })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/todo al día/i)).toBeInTheDocument()
    })
  })

  it("debe listar procesos con novedades", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue(NOVEDADES_MOCK)
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/05001310301720240048000/)).toBeInTheDocument()
      expect(screen.getByText(/05001400300520230010000/)).toBeInTheDocument()
    })
  })

  it("debe expandir una novedad al hacer clic", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue(NOVEDADES_MOCK)
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/05001310301720240048000/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/05001310301720240048000/))
    await waitFor(() => {
      expect(screen.getByText("Auto admite demanda")).toBeInTheDocument()
    })
  })

  it("debe mostrar botón volver que navega a /", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({ total: 0, novedades: [] })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/volver/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/volver/i))
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })
})

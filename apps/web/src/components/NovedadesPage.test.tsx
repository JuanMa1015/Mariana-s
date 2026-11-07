import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock("../api", () => ({ getNovedadesDetalle: vi.fn(), marcarTodoLeido: vi.fn() }))

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
      canales_notificados: "email+telegram",
      notificacion_pendiente: false,
      intentos_notificacion: 0,
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
      canales_notificados: null,
      notificacion_pendiente: true,
      intentos_notificacion: 2,
      actuaciones: [],
    },
  ],
}

beforeEach(async () => {
  vi.clearAllMocks()
})

describe("NovedadesPage", () => {
  it("pide confirmación antes de marcar todas y recarga al confirmar", async () => {
    const api = await import("../api")
    vi.mocked(api.getNovedadesDetalle).mockResolvedValueOnce(NOVEDADES_MOCK).mockResolvedValueOnce({ total: 0, novedades: [] })
    vi.mocked(api.marcarTodoLeido).mockResolvedValueOnce({ marcados: 2 })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    fireEvent.click(await screen.findByRole("button", { name: "Marcar todo como leído" }))
    expect(api.marcarTodoLeido).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Marcar todo como leído" }))
    fireEvent.click(screen.getByRole("button", { name: "Sí, marcar todo" }))
    expect(await screen.findByText(/todo al día/i)).toBeInTheDocument()
    expect(api.marcarTodoLeido).toHaveBeenCalledTimes(1)
  })

  it("mantiene la confirmación y permite reintentar si falla el marcado", async () => {
    const api = await import("../api")
    vi.mocked(api.getNovedadesDetalle).mockResolvedValue(NOVEDADES_MOCK)
    vi.mocked(api.marcarTodoLeido).mockRejectedValueOnce(new Error("sin conexión"))
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    fireEvent.click(await screen.findByRole("button", { name: "Marcar todo como leído" }))
    fireEvent.click(screen.getByRole("button", { name: "Sí, marcar todo" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Sí, marcar todo" })).toBeEnabled())
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(api.getNovedadesDetalle).toHaveBeenCalledTimes(1)
  })
  it("muestra cinco actuaciones y permite revelar las siguientes sin afectar otros procesos", async () => {
    const actuaciones = Array.from({ length: 12 }, (_, i) => ({
      ...NOVEDADES_MOCK.novedades[0].actuaciones[0],
      id_reg_actuacion: i + 1,
      actuacion: `Actuación de prueba ${i + 1}`,
      anotacion: `Anotación de prueba ${i + 1}`,
    }))
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({
      ...NOVEDADES_MOCK, novedades: [{ ...NOVEDADES_MOCK.novedades[0], actuaciones }],
    })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    fireEvent.click(await screen.findByText(/05001 31 03 017 2024 00480 00/))
    expect(screen.getByText("Anotación de prueba 5")).toBeInTheDocument()
    expect(screen.queryByText("Anotación de prueba 6")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ver más actuaciones" }))
    expect(screen.getByText("Anotación de prueba 10")).toBeInTheDocument()
    expect(screen.queryByText("Anotación de prueba 11")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ver más actuaciones" }))
    expect(screen.getByText("Anotación de prueba 12")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ver más actuaciones" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/05001 31 03 017 2024 00480 00/))
    fireEvent.click(screen.getByText(/05001 31 03 017 2024 00480 00/))
    expect(screen.queryByText("Anotación de prueba 6")).not.toBeInTheDocument()
  })
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
      expect(screen.getByText(/05001 31 03 017 2024 00480 00/)).toBeInTheDocument()
      expect(screen.getByText(/05001 40 03 005 2023 00100 00/)).toBeInTheDocument()
    })
  })

  it("debe expandir una novedad al hacer clic", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue(NOVEDADES_MOCK)
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/05001 31 03 017 2024 00480 00/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/05001 31 03 017 2024 00480 00/))
    await waitFor(() => {
      expect(screen.getAllByText("Auto admite demanda").length).toBeGreaterThan(0)
    })
  })

  it("debe mostrar botón volver que navega a /procesos", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({ total: 0, novedades: [] })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/volver/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/volver/i))
    expect(mockNavigate).toHaveBeenCalledWith("/procesos")
  })

  it("muestra por que canales fue avisado cada radicado", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({
      total: 3,
      novedades: [
        { ...NOVEDADES_MOCK.novedades[0], canales_notificados: "email+telegram" },
        { ...NOVEDADES_MOCK.novedades[1], notificacion_pendiente: false, canales_notificados: "telegram" },
        { ...NOVEDADES_MOCK.novedades[1], llave_proceso: "05001500300520230010000", notificacion_pendiente: true, intentos_notificacion: 2, canales_notificados: null },
      ],
    })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/correo y telegram/i)).toBeInTheDocument()
      expect(screen.getByText(/^telegram$/i)).toBeInTheDocument()
      expect(screen.getByText(/^sin avisar/i)).toBeInTheDocument()
    })
  })

  it("indica cuando el aviso también llegó a la app del celular (push)", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({
      total: 1,
      novedades: [{ ...NOVEDADES_MOCK.novedades[0], notificacion_pendiente: false, canales_notificados: "email+telegram+push" }],
    })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => expect(screen.getByText(/correo, telegram, app/i)).toBeInTheDocument())
  })

  it("no muestra insignia cuando la novedad no tiene registro de envio (legacy)", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({
      total: 1,
      novedades: [
        { ...NOVEDADES_MOCK.novedades[0], canales_notificados: null, notificacion_pendiente: false, intentos_notificacion: 0 },
      ],
    })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/05001 31 03 017 2024 00480 00/)).toBeInTheDocument()
    })
    expect(screen.queryByText(/sin aviso/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/avisado/i)).not.toBeInTheDocument()
  })

  it("avisa cuando se agotaron los reintentos del aviso", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({
      total: 1,
      intentos_max_aviso: 5,
      novedades: [
        { ...NOVEDADES_MOCK.novedades[0], canales_notificados: null, notificacion_pendiente: true, intentos_notificacion: 5 },
      ],
    })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/no se pudo avisar/i)).toBeInTheDocument()
    })
  })

  it("respeta el tope de reintentos que viene del backend", async () => {
    // Tope custom (2): con 2 intentos ya debe mostrar el estado agotado
    vi.mocked((await import("../api")).getNovedadesDetalle).mockResolvedValue({
      total: 1,
      intentos_max_aviso: 2,
      novedades: [
        { ...NOVEDADES_MOCK.novedades[0], canales_notificados: null, notificacion_pendiente: true, intentos_notificacion: 2 },
      ],
    })
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/no se pudo avisar/i)).toBeInTheDocument()
      expect(screen.queryByText(/sin avisar/i)).not.toBeInTheDocument()
    })
  })

  it("muestra error en vez de 'todo al dia' cuando la carga falla", async () => {
    vi.mocked((await import("../api")).getNovedadesDetalle).mockRejectedValue(new Error("red caida"))
    const { default: NovedadesPage } = await import("./NovedadesPage")
    render(<BrowserRouter><NovedadesPage /></BrowserRouter>)
    await waitFor(() => {
      expect(screen.getByText(/no se pudieron cargar las novedades/i)).toBeInTheDocument()
      expect(screen.queryByText(/todo al día/i)).not.toBeInTheDocument()
    })
  })
})

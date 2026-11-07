import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...(actual as typeof import('react-router-dom')), useNavigate: () => mockNavigate }
})

const mockGetProcesos = vi.fn()
const mockGetNovedades = vi.fn()
const mockPostSync = vi.fn()
const mockGetSyncEstado = vi.fn()
const mockPostAddRadicado = vi.fn()
const mockGetProceso = vi.fn()

vi.mock('./api', () => ({
  getProcesos: mockGetProcesos,
  getNovedades: mockGetNovedades,
  postSync: mockPostSync,
  getSyncEstado: mockGetSyncEstado,
  postAddRadicado: mockPostAddRadicado,
  getProceso: mockGetProceso,
}))

const toastImpl = { loading: vi.fn(() => 'toast-id'), success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('react-hot-toast', () => ({ default: toastImpl }))

vi.mock('./api/cache', () => ({ getCache: () => null, setCache: () => {}, removeCache: () => {} }))

// Ping de /health usado por el indicador de conexion
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('scrollTo', vi.fn())
  mockGetProcesos.mockResolvedValue({ total: 0, procesos: [] })
  mockGetNovedades.mockResolvedValue({ total: 0, novedades: [] })
  mockPostSync.mockRejectedValue(new Error("Error de conexión"))
})

it("permite reintentar un expediente cuando su consulta falla", async () => {
  mockGetProceso.mockRejectedValue(new Error("red caída"))
  const App = (await import('./App')).default
  render(<MemoryRouter initialEntries={["/procesos/123"]}><Routes><Route path="/procesos/:llaveProceso" element={<App />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole("button", { name: "Reintentar expediente" })).toBeInTheDocument()
  expect(screen.queryByText("Cargando proceso...")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Reintentar expediente" }))
  await vi.waitFor(() => expect(mockGetProceso).toHaveBeenCalledTimes(2))
})

it("explica un expediente inexistente y vuelve al listado conservando sus filtros", async () => {
  const { ApiError } = await import('./api/errors')
  mockGetProceso.mockRejectedValueOnce(new ApiError("No existe", 404))
  const App = (await import('./App')).default
  render(<MemoryRouter initialEntries={["/procesos/123?categoria=Trabajo&q=Pérez"]}><Routes><Route path="/procesos/:llaveProceso" element={<App />} /></Routes></MemoryRouter>)
  expect(await screen.findByText("El expediente no existe o ya no está en tu lista de seguimiento.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Volver a procesos" }))
  expect(mockNavigate).toHaveBeenCalledWith("/procesos?categoria=Trabajo&q=P%C3%A9rez")
})

it("vuelve a novedades cuando el expediente se abrió desde allí", async () => {
  mockGetProceso.mockRejectedValueOnce(new Error("red"))
  const App = (await import('./App')).default
  render(<MemoryRouter initialEntries={[{ pathname: "/procesos/123", state: { from: "/novedades" } }]}><Routes><Route path="/procesos/:llaveProceso" element={<App />} /></Routes></MemoryRouter>)
  fireEvent.click(await screen.findByRole("button", { name: "Volver a procesos" }))
  expect(mockNavigate).toHaveBeenCalledWith("/novedades")
})

it("muestra una lista fallida con reintento en lugar de un esqueleto permanente", async () => {
  mockGetProcesos.mockRejectedValue(new Error("red caída"))
  const App = (await import('./App')).default
  render(<BrowserRouter><App /></BrowserRouter>)
  expect(await screen.findByRole("button", { name: "Reintentar lista" })).toBeInTheDocument()
  expect(screen.queryByText("No hay novedades pendientes en la última consulta.")).not.toBeInTheDocument()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it("conserva categoría y orden al buscar y reinicia la página", async () => {
  const App = (await import('./App')).default
  render(<MemoryRouter initialEntries={["/procesos?pagina=2&categoria=Trabajo&orden=reciente"]}><App /></MemoryRouter>)
  await vi.waitFor(() => expect(mockGetProcesos).toHaveBeenCalledWith(undefined, undefined, 25, 25, "Trabajo", undefined, "reciente"))
  fireEvent.change(screen.getByPlaceholderText("Buscar radicado o cliente"), { target: { value: "Pérez" } })
  await vi.waitFor(() => expect(mockGetProcesos).toHaveBeenLastCalledWith(undefined, undefined, 0, 25, "Trabajo", "Pérez", "reciente"))
  fireEvent.click(screen.getByRole("button", { name: "Todas" }))
  await vi.waitFor(() => expect(mockGetProcesos).toHaveBeenLastCalledWith(undefined, undefined, 0, 25, undefined, "Pérez", "reciente"))
  fireEvent.change(screen.getByPlaceholderText("Buscar radicado o cliente"), { target: { value: "" } })
  await vi.waitFor(() => expect(mockGetProcesos).toHaveBeenLastCalledWith(undefined, undefined, 0, 25, undefined, undefined, "reciente"))
})

it("evita agregar dos veces el mismo radicado mientras el servidor responde", async () => {
  let terminar!: (res: { created: boolean }) => void
  mockPostAddRadicado.mockReturnValueOnce(new Promise((resolve) => { terminar = resolve }))
  const App = (await import('./App')).default
  render(<MemoryRouter><App /></MemoryRouter>)
  fireEvent.change(screen.getByRole("textbox", { name: "Radicado de 23 dígitos" }), { target: { value: "05001310301720240048000" } })
  fireEvent.click(screen.getByRole("button", { name: "Agregar" }))
  expect(screen.getByRole("button", { name: "Agregando…" })).toBeDisabled()
  expect(mockPostAddRadicado).toHaveBeenCalledTimes(1)
  terminar({ created: true })
  await vi.waitFor(() => expect(toastImpl.success).toHaveBeenCalledWith("Radicado agregado exitosamente", expect.any(Object)))
  expect(screen.getByRole("textbox", { name: "Radicado de 23 dígitos" })).toHaveValue("")
})

it("distingue una sincronización parcial de una completa", async () => {
  vi.useFakeTimers()
  mockPostSync.mockResolvedValueOnce({ iniciado: false, en_curso: true })
  mockGetSyncEstado.mockResolvedValueOnce({ en_curso: true }).mockResolvedValueOnce({ en_curso: false,
    resultado: { nuevos: 0, actualizados: 1, total_consultados: 2, errores_rama: 1 } })
  const App = (await import('./App')).default
  render(<MemoryRouter><App /></MemoryRouter>)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  fireEvent.click(screen.getByRole("button", { name: /sincronizar procesos/i }))
  await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
  expect(toastImpl.error).toHaveBeenCalledWith("Consulta parcial. Algunos expedientes siguen pendientes de verificar.", expect.any(Object))
  expect(toastImpl.success).not.toHaveBeenCalled()
  expect(mockGetProcesos).toHaveBeenCalledTimes(2)
})

it("debe mostrar toast generico cuando sync falla", async () => {
  const App = (await import('./App')).default
  render(<BrowserRouter><App /></BrowserRouter>)

  const btn = screen.getByRole("button", { name: /sincronizar/i })
  await userEvent.click(btn)

  await vi.waitFor(() => {
    expect(toastImpl.error).toHaveBeenCalledWith("Error al sincronizar. Intenta de nuevo.", expect.any(Object))
  })
})

it("con el servidor despierto no muestra avisos de conexion", async () => {
  const App = (await import('./App')).default
  render(<BrowserRouter><App /></BrowserRouter>)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(screen.queryByText(/conectando con la aplicacion/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/no hay conexion/i)).not.toBeInTheDocument()
})

it("al primer fallo muestra un aviso amable de conexion (no rojo de API)", async () => {
  fetchMock.mockRejectedValue(new Error("timeout"))
  const App = (await import('./App')).default
  render(<BrowserRouter><App /></BrowserRouter>)

  expect(await screen.findByText(/conectando con la aplicación/i)).toBeInTheDocument()
  // Lenguaje para usuarios no tecnicos: sin "API" ni "recargue la pagina"
  expect(screen.queryByText(/API/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/recarga/i)).not.toBeInTheDocument()
})

it("tras varios fallos explica que los datos no se perdieron y ofrece reintentar", async () => {
  vi.useFakeTimers()
  fetchMock.mockRejectedValue(new Error("timeout"))
  const App = (await import('./App')).default
  render(<BrowserRouter><App /></BrowserRouter>)

  // Ping inicial + 3 reintentos del intervalo (60s cada uno) = 4 fallos seguidos.
  // El ultimo flush adicional deja drenar el render agendado por React
  // (MessageChannel tambien queda bajo fake timers).
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  for (let i = 0; i < 3; i++) await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })

  expect(screen.getByText(/tus procesos no se han perdido/i)).toBeInTheDocument()
  expect(screen.getByText(/última visita/i)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /reintentar ahora/i })).toBeInTheDocument()
})

it("al recuperarse la conexion quita el aviso y recarga la lista", async () => {
  vi.useFakeTimers()
  fetchMock.mockRejectedValueOnce(new Error("timeout"))
  const App = (await import('./App')).default
  render(<BrowserRouter><App /></BrowserRouter>)

  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(await vi.waitFor(() => screen.getByText(/conectando con la aplicación/i))).toBeInTheDocument()

  // Siguiente ping exitoso (60s despues): el aviso desaparece y se recarga
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(screen.queryByText(/conectando con la aplicación/i)).not.toBeInTheDocument()
  await vi.waitFor(() => expect(mockGetProcesos).toHaveBeenCalledTimes(2))
})

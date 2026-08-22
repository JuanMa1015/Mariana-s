import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

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
  mockGetProcesos.mockResolvedValue({ total: 0, procesos: [] })
  mockGetNovedades.mockResolvedValue({ total: 0, novedades: [] })
  mockPostSync.mockRejectedValue(new Error("Error de conexión"))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
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

  // Ping inicial + 3 reintentos del intervalo (15s cada uno) = 4 fallos seguidos.
  // El ultimo flush adicional deja drenar el render agendado por React
  // (MessageChannel tambien queda bajo fake timers).
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(15000)
  await vi.advanceTimersByTimeAsync(0)

  expect(screen.getByText(/tus procesos no se han perdido/i)).toBeInTheDocument()
  expect(screen.getByText(/última visita/i)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /reintentar ahora/i })).toBeInTheDocument()
})

it("al recuperarse la conexion quita el aviso y recarga la lista", async () => {
  vi.useFakeTimers()
  fetchMock.mockRejectedValueOnce(new Error("timeout"))
  const App = (await import('./App')).default
  render(<BrowserRouter><App /></BrowserRouter>)

  await vi.advanceTimersByTimeAsync(0)
  expect(await vi.waitFor(() => screen.getByText(/conectando con la aplicación/i))).toBeInTheDocument()

  // Siguiente ping exitoso (15s despues): el aviso desaparece y se recarga
  await vi.advanceTimersByTimeAsync(15000)
  expect(screen.queryByText(/conectando con la aplicación/i)).not.toBeInTheDocument()
  await vi.waitFor(() => expect(mockGetProcesos).toHaveBeenCalledTimes(2))
})

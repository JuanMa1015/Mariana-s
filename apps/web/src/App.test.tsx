import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual as any, useNavigate: () => mockNavigate }
})

const mockGetProcesos = vi.fn()
const mockGetNovedades = vi.fn()
const mockPostSync = vi.fn()
const mockPostAddRadicado = vi.fn()
const mockGetProceso = vi.fn()

vi.mock('./api', () => ({
  getProcesos: (...args: any[]) => mockGetProcesos(...args),
  getNovedades: (...args: any[]) => mockGetNovedades(...args),
  postSync: (...args: any[]) => mockPostSync(...args),
  postAddRadicado: (...args: any[]) => mockPostAddRadicado(...args),
  getProceso: (...args: any[]) => mockGetProceso(...args),
}))

const mockToast = { loading: vi.fn(() => 'toast-id'), success: vi.fn(), error: vi.fn() }
vi.mock('react-hot-toast', () => ({
  default: { loading: (...a: any[]) => mockToast.loading(...a), success: (...a: any[]) => mockToast.success(...a), error: (...a: any[]) => mockToast.error(...a) },
}))

vi.mock('./api/cache', () => ({ getCache: vi.fn(() => null), setCache: vi.fn(), removeCache: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  mockGetProcesos.mockResolvedValue({ total: 0, procesos: [] })
  mockGetNovedades.mockResolvedValue({ total: 0, novedades: [] })
  mockPostSync.mockRejectedValue(new Error("Error de conexión"))
})

it("debe mostrar toast generico cuando sync falla", async () => {
  const App = (await import('./App')).default
  render(<BrowserRouter><App /></BrowserRouter>)

  const btn = screen.getByRole("button", { name: /sincronizar/i })
  await userEvent.click(btn)

  await vi.waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("Error al sincronizar. Intenta de nuevo.", expect.any(Object))
  })
})

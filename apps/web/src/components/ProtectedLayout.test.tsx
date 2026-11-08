import { beforeEach, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import ProtectedLayout from "./ProtectedLayout"
import { getMe } from "../api"
import { ApiError } from "../api/errors"

vi.mock("../api", () => ({ getMe: vi.fn() }))
vi.mock("./AvisosPush", () => ({ default: () => null }))
vi.mock("../hooks/useAvatar", () => ({ limpiarAvatar: vi.fn() }))

function LoginDestino() {
  const location = useLocation()
  return <p>Entrar para {location.state?.from}</p>
}

function abrir(ruta = "/procesos/123?q=cliente") {
  return render(<MemoryRouter initialEntries={[ruta]}><Routes>
    <Route element={<ProtectedLayout />}>
      <Route path="/procesos" element={<h1>Mis procesos</h1>} />
      <Route path="/procesos/:id" element={<h1>Expediente</h1>} />
      <Route path="/novedades" element={<h1>Novedades</h1>} />
      <Route path="/admin" element={<h1>Administración</h1>} />
      <Route path="/ajustes" element={<h1>Ajustes</h1>} />
    </Route>
    <Route path="/login" element={<LoginDestino />} />
  </Routes></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

it.each(["/procesos", "/procesos/123", "/novedades"])("lleva la cuenta de gestión al panel desde %s", async (ruta) => {
  vi.mocked(getMe).mockResolvedValueOnce({ email: "admin@example.test", es_admin: true })
  abrir(ruta)
  expect(await screen.findByRole("heading", { name: "Administración" })).toBeInTheDocument()
  expect(screen.queryByRole("navigation", { name: "Navegación principal" })).not.toBeInTheDocument()
})

it("permite abrir los ajustes de la cuenta de gestión", async () => {
  vi.mocked(getMe).mockResolvedValueOnce({ email: "admin@example.test", es_admin: true })
  abrir("/ajustes")
  expect(await screen.findByRole("heading", { name: "Ajustes" })).toBeInTheDocument()
})

it("ofrece reintentar al fallar la red sin pedir credenciales de nuevo", async () => {
  vi.mocked(getMe).mockRejectedValueOnce(new Error("sin conexión")).mockResolvedValueOnce({ email: "abogada@example.test" })
  abrir()
  expect(await screen.findByText("No pudimos verificar tu sesión")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByRole("heading", { name: "Expediente" })).toBeInTheDocument()
  expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument()
})

it("conserva el destino del expediente cuando la sesión vence", async () => {
  vi.mocked(getMe).mockRejectedValueOnce(new ApiError("vencida", 401))
  abrir()
  expect(await screen.findByText("Entrar para /procesos/123?q=cliente")).toBeInTheDocument()
})

it("abandona el expediente si una petición detecta la sesión vencida", async () => {
  vi.mocked(getMe).mockResolvedValueOnce({ email: "abogada@example.test" })
  abrir()
  await screen.findByRole("heading", { name: "Expediente" })
  fireEvent(window, new Event("session-expired"))
  expect(await screen.findByText("Entrar para /procesos/123?q=cliente")).toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Expediente" })).not.toBeInTheDocument()
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const api = vi.hoisted(() => ({
  getMe: vi.fn(async () => ({ es_admin: false })),
  borrarAvatar: vi.fn(async () => undefined),
  subirAvatar: vi.fn(async () => undefined),
  cambiarUsuario: vi.fn(async (u: string) => ({ username: u })),
  solicitarCambioPassword: vi.fn(async () => ({ email: "t***@example.com" })),
  enviarAvisoDePrueba: vi.fn(async (d: number) => (d ? { enviados: 0, programado_en: d } : { enviados: 1 })),
}))
const push = vi.hoisted(() => ({
  pushDisponible: true,
  permisoActual: vi.fn(async () => "granted"),
  pedirPermiso: vi.fn(async () => "granted"),
  activarPush: vi.fn(async () => undefined),
}))
vi.mock("../push", () => push)
vi.mock("../api", () => api)
vi.mock("../hooks/useAvatar", () => ({ useAvatar: () => null, recargarAvatar: vi.fn(async () => undefined) }))
vi.mock("../session", () => ({ cerrarSesion: vi.fn(async () => undefined) }))
vi.mock("../utils/imagen", () => ({ redimensionarAvatar: vi.fn(async () => new Blob(["x"], { type: "image/jpeg" })) }))
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => "t") }) }))

import AjustesPage from "./AjustesPage"

const abrir = () => render(<MemoryRouter><AjustesPage /></MemoryRouter>)

describe("AjustesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem("email", "test@example.com")
    localStorage.setItem("username", "testuser")
    document.documentElement.className = ""
  })

  it("muestra el perfil y cambia el tema al elegir oscuro", () => {
    abrir()
    expect(screen.getByText("test@example.com")).toBeInTheDocument()
    expect(screen.getByText("testuser")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Oscuro/))
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("mariana_tema")).toBe("oscuro")
  })

  it("cambiar el usuario exige la contraseña actual", async () => {
    abrir()
    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }))
    fireEvent.change(screen.getByLabelText("Nuevo nombre de usuario"), { target: { value: "nuevo.usuario" } })
    fireEvent.change(screen.getByLabelText("Tu contraseña actual"), { target: { value: "password123" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(api.cambiarUsuario).toHaveBeenCalledWith("nuevo.usuario", "password123"))
    expect(await screen.findByText("nuevo.usuario")).toBeInTheDocument()
    expect(localStorage.getItem("username")).toBe("nuevo.usuario")
  })

  it("pide el correo de restablecimiento", async () => {
    abrir()
    fireEvent.click(screen.getByRole("button", { name: "Enviarme el enlace por correo" }))
    await waitFor(() => expect(api.solicitarCambioPassword).toHaveBeenCalledTimes(1))
  })

  it("sube la foto reducida", async () => {
    abrir()
    const archivo = new File(["x"], "yo.png", { type: "image/png" })
    fireEvent.change(screen.getByLabelText("Elegir foto de perfil"), { target: { files: [archivo] } })
    await waitFor(() => expect(api.subirAvatar).toHaveBeenCalledTimes(1))
  })

  it("muestra el estado de las notificaciones y oculta las herramientas de soporte", async () => {
    abrir()
    expect(await screen.findByText(/Activadas: te avisamos/)).toBeInTheDocument()
    expect(screen.queryByText(/probar avisos/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Enviar en 15 s/ })).not.toBeInTheDocument()
  })

  it("siete toques sobre la versión activan la prueba de avisos con la app cerrada", async () => {
    abrir()
    await screen.findByText(/Activadas: te avisamos/)
    const version = screen.getByRole("button", { name: /Mariana's v/ })
    for (let i = 0; i < 7; i++) fireEvent.click(version)
    fireEvent.click(await screen.findByRole("button", { name: "Enviar en 15 s" }))
    await waitFor(() => expect(api.enviarAvisoDePrueba).toHaveBeenCalledWith(15))
  })

  it("si falta el permiso ofrece activarlo", async () => {
    push.permisoActual.mockResolvedValueOnce("prompt")
    abrir()
    fireEvent.click(await screen.findByRole("button", { name: "Activar avisos" }))
    await waitFor(() => expect(push.activarPush).toHaveBeenCalled())
  })
})

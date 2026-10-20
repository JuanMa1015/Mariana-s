import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const api = vi.hoisted(() => ({
  borrarAvatar: vi.fn(async () => undefined),
  subirAvatar: vi.fn(async () => undefined),
  cambiarUsuario: vi.fn(async (u: string) => ({ username: u })),
  solicitarCambioPassword: vi.fn(async () => ({ email: "t***@example.com" })),
}))
vi.mock("../api", () => api)
vi.mock("../hooks/useAvatar", () => ({ useAvatar: () => null, recargarAvatar: vi.fn(async () => undefined) }))
vi.mock("../session", () => ({ cerrarSesion: vi.fn(async () => undefined) }))
vi.mock("../utils/imagen", () => ({ redimensionarAvatar: vi.fn(async () => new Blob(["x"], { type: "image/jpeg" })) }))
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

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
})

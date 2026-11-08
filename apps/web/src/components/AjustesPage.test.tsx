import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

const api = vi.hoisted(() => ({
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
  estadoRegistroPush: vi.fn(() => "registrado"),
  suscribirRegistroPush: vi.fn(() => () => undefined),
}))
vi.mock("../push", () => push)
vi.mock("../api", () => api)
vi.mock("../hooks/useAvatar", () => ({ useAvatar: () => null, recargarAvatar: vi.fn(async () => undefined) }))
vi.mock("../session", () => ({ cerrarSesion: vi.fn(async () => undefined) }))
vi.mock("../utils/imagen", () => ({ redimensionarAvatar: vi.fn(async () => new Blob(["x"], { type: "image/jpeg" })) }))
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => "t") }) }))

import AjustesPage from "./AjustesPage"

const abrir = (esAdmin = false) => render(
  <MemoryRouter initialEntries={["/ajustes"]}>
    <Routes>
      <Route element={<Outlet context={esAdmin} />}>
        <Route path="/ajustes" element={<AjustesPage />} />
        <Route path="/admin" element={<h1>Administración</h1>} />
      </Route>
    </Routes>
  </MemoryRouter>,
)

describe("AjustesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    push.estadoRegistroPush.mockReturnValue("registrado")
    localStorage.clear()
    localStorage.setItem("email", "test@example.com")
    localStorage.setItem("username", "testuser")
    document.documentElement.className = ""
  })

  it("muestra el perfil y permite cambiar el tema con el teclado", async () => {
    localStorage.setItem("mariana_tema", "claro")
    abrir()
    expect(screen.getByText("test@example.com")).toBeInTheDocument()
    expect(screen.getByText("testuser")).toBeInTheDocument()
    screen.getByRole("radio", { name: "Claro" }).focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("radio", { name: "Oscuro" })).toBeChecked()
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("mariana_tema")).toBe("oscuro")
  })

  it("mantiene los ajustes de gestión separados de los avisos de actuaciones", async () => {
    abrir(true)
    expect(screen.queryByRole("heading", { name: "Avisos de actuaciones" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Volver a Administración" }))
    expect(await screen.findByRole("heading", { name: "Administración" })).toBeInTheDocument()
  })

  it("vuelve a comprobar el permiso al regresar de los ajustes del celular", async () => {
    push.permisoActual.mockResolvedValueOnce("denied")
    abrir()
    expect(await screen.findByText("Bloqueado")).toBeInTheDocument()
    fireEvent.focus(window)
    expect(await screen.findByText("Concedido")).toBeInTheDocument()
  })

  it("cambiar el usuario exige la contraseña actual", async () => {
    abrir()
    fireEvent.click(screen.getByRole("button", { name: "Cambiar usuario" }))
    expect(screen.getByLabelText("Nuevo nombre de usuario")).toHaveFocus()
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
    expect(await screen.findByRole("status")).toHaveTextContent("Te enviamos un enlace a t***@example.com. Vence en 30 minutos.")
  })

  it("sube la foto reducida", async () => {
    abrir()
    const archivo = new File(["x"], "yo.png", { type: "image/png" })
    fireEvent.change(screen.getByLabelText("Elegir foto de perfil"), { target: { files: [archivo] } })
    await waitFor(() => expect(api.subirAvatar).toHaveBeenCalledTimes(1))
  })

  it("distingue el permiso concedido de un fallo de registro", async () => {
    push.estadoRegistroPush.mockReturnValue("error")
    abrir()
    expect(await screen.findByText("Concedido")).toBeInTheDocument()
    expect(screen.getByText("No se pudo registrar")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Enviar aviso de prueba" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Reintentar registro" }))
    await waitFor(() => expect(push.activarPush).toHaveBeenCalledOnce())
  })

  it("ofrece una prueba visible y permite confirmar que llegó a este celular", async () => {
    abrir()
    fireEvent.click(await screen.findByRole("button", { name: "Enviar aviso de prueba" }))
    expect(await screen.findByText(/Aviso de prueba enviado/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Sí, llegó" }))
    expect(screen.getByText("Confirmaste que el aviso llegó a este celular.")).toBeInTheDocument()
    expect(api.enviarAvisoDePrueba).toHaveBeenCalledWith(0)
  })

  it("si falta el permiso ofrece activarlo", async () => {
    push.permisoActual.mockResolvedValueOnce("prompt")
    abrir()
    fireEvent.click(await screen.findByRole("button", { name: "Activar avisos" }))
    await waitFor(() => expect(push.activarPush).toHaveBeenCalled())
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"

vi.mock("../api", () => ({
  registerUser: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockToast = { loading: vi.fn((..._: any[]) => "tid"), success: vi.fn((..._: any[]) => {}), error: vi.fn((..._: any[]) => {}) }
vi.mock("react-hot-toast", () => ({
  default: {
    loading: (...a: any[]) => mockToast.loading(...a),
    success: (...a: any[]) => mockToast.success(...a),
    error: (...a: any[]) => mockToast.error(...a),
  },
}))

beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe("Register", () => {
  it("debe renderizar el formulario con todos los campos", async () => {
    const { default: Register } = await import("./Register")
    render(<BrowserRouter><Register /></BrowserRouter>)
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/nombre de usuario/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /registrarse/i })).toBeInTheDocument()
  })

  it("debe permitir escribir en los campos", async () => {
    const { default: Register } = await import("./Register")
    render(<BrowserRouter><Register /></BrowserRouter>)
    const emailInput = screen.getByLabelText(/correo electrónico/i)
    fireEvent.change(emailInput, { target: { value: "test@example.com" } })
    expect((emailInput as HTMLInputElement).value).toBe("test@example.com")

    const usernameInput = screen.getByLabelText(/nombre de usuario/i)
    fireEvent.change(usernameInput, { target: { value: "usuario1" } })
    expect((usernameInput as HTMLInputElement).value).toBe("usuario1")
  })

  it("debe filtrar caracteres especiales en nombre de usuario", async () => {
    const { default: Register } = await import("./Register")
    render(<BrowserRouter><Register /></BrowserRouter>)
    const usernameInput = screen.getByLabelText(/nombre de usuario/i)
    fireEvent.change(usernameInput, { target: { value: "user@# name!" } })
    expect((usernameInput as HTMLInputElement).value).toBe("username")
  })

  it("debe enviar el formulario y navegar a / en éxito", async () => {
    const { default: Register } = await import("./Register")
    const { registerUser } = await import("../api")
    vi.mocked(registerUser).mockResolvedValue({
      access_token: "tok",
      email: "test@example.com",
      username: "tester",
    })

    render(<BrowserRouter><Register /></BrowserRouter>)
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: "test@example.com" } })
    fireEvent.change(screen.getByLabelText(/nombre de usuario/i), { target: { value: "tester" } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "pass123" } })
    fireEvent.click(screen.getByRole("button", { name: /registrarse/i }))

    await waitFor(() => {
      expect(registerUser).toHaveBeenCalledWith({
        email: "test@example.com",
        username: "tester",
        password: "pass123",
      })
    })

    expect(localStorage.getItem("token")).toBe("tok")
    expect(localStorage.getItem("email")).toBe("test@example.com")
    expect(localStorage.getItem("username")).toBe("tester")
    expect(mockToast.success).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("debe mostrar error toast cuando el registro falla", async () => {
    const { default: Register } = await import("./Register")
    const { registerUser } = await import("../api")
    vi.mocked(registerUser).mockRejectedValue(new Error("Email ya existe"))

    render(<BrowserRouter><Register /></BrowserRouter>)
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: "dup@example.com" } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "pass123" } })
    fireEvent.click(screen.getByRole("button", { name: /registrarse/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Email ya existe", expect.any(Object))
    })
  })

  it("debe tener un enlace a la página de login", async () => {
    const { default: Register } = await import("./Register")
    render(<BrowserRouter><Register /></BrowserRouter>)
    const link = screen.getByRole("link", { name: /inicia sesión/i })
    expect(link).toHaveAttribute("href", "/login")
  })
})

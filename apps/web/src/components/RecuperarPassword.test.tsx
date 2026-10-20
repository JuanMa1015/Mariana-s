import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const api = vi.hoisted(() => ({
  olvidePassword: vi.fn(async () => undefined),
  restablecerPassword: vi.fn(async () => undefined),
}))
vi.mock("../api", () => api)
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { OlvidePage, RestablecerPage } from "./RecuperarPassword"

const en = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe("recuperar contraseña", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = ""
  })

  it("«Olvidé» confirma sin revelar si la cuenta existe", async () => {
    en(<OlvidePage />)
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "nadie@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviarme el enlace" }))
    await waitFor(() => expect(api.olvidePassword).toHaveBeenCalledWith("nadie@example.com"))
    expect(await screen.findByRole("status")).toHaveTextContent("Si nadie@example.com tiene una cuenta")
  })

  it("sin token en el enlace ofrece pedir uno nuevo", () => {
    en(<RestablecerPage />)
    expect(screen.getByText("Enlace no válido")).toBeInTheDocument()
  })

  it("valida coincidencia y envía el token del fragmento", async () => {
    window.location.hash = "#token=abc123"
    en(<RestablecerPage />)
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "ClaveNueva#2026" } })
    fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: "otra-distinta" } })
    fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("no coinciden")
    expect(api.restablecerPassword).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: "ClaveNueva#2026" } })
    fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }))
    await waitFor(() => expect(api.restablecerPassword).toHaveBeenCalledWith("abc123", "ClaveNueva#2026"))
  })
})

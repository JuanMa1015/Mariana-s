import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const push = vi.hoisted(() => ({
  pushDisponible: true,
  permisoActual: vi.fn(),
  pedirPermiso: vi.fn(),
  activarPush: vi.fn(async () => undefined),
  escucharPush: vi.fn(async () => () => undefined),
}))
vi.mock("../push", () => push)
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import AvisosPush from "./AvisosPush"
import AvisoPermisoPush from "./AvisoPermisoPush"

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe("AvisosPush (conexión sin interfaz)", () => {
  it("conecta los eventos y registra el celular si el permiso ya está concedido", async () => {
    push.permisoActual.mockResolvedValue("granted")
    const { container } = render(<AvisosPush onAbrirProceso={() => undefined} />)
    await waitFor(() => expect(push.activarPush).toHaveBeenCalledTimes(1))
    expect(push.escucharPush).toHaveBeenCalledTimes(1)
    expect(container).toBeEmptyDOMElement()
  })

  it("no registra el celular mientras el usuario no haya dado permiso", async () => {
    push.permisoActual.mockResolvedValue("prompt")
    render(<AvisosPush onAbrirProceso={() => undefined} />)
    await waitFor(() => expect(push.permisoActual).toHaveBeenCalled())
    expect(push.activarPush).not.toHaveBeenCalled()
  })
})

describe("AvisoPermisoPush (tarjeta de la pantalla principal)", () => {
  it("explica y pide el permiso solo cuando el usuario pulsa Activar", async () => {
    push.permisoActual.mockResolvedValue("prompt")
    push.pedirPermiso.mockResolvedValue("granted")
    render(<AvisoPermisoPush />)

    expect(await screen.findByText("Activa los avisos en tu celular")).toBeInTheDocument()
    expect(push.pedirPermiso).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Activar avisos" }))
    await waitFor(() => expect(push.activarPush).toHaveBeenCalled())
    expect(screen.queryByRole("region", { name: "Avisos en tu celular" })).not.toBeInTheDocument()
  })

  it("con los avisos activos no muestra nada (ni botón de prueba)", async () => {
    push.permisoActual.mockResolvedValue("granted")
    const { container } = render(<AvisoPermisoPush />)
    await waitFor(() => expect(push.permisoActual).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/prueba/i)).not.toBeInTheDocument()
  })

  it("si está bloqueado explica cómo habilitarlo y «Entendido» lo pospone", async () => {
    push.permisoActual.mockResolvedValue("denied")
    render(<AvisoPermisoPush />)
    expect(await screen.findByText("Los avisos están bloqueados")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }))
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    expect(localStorage.getItem("mariana_push_snooze")).not.toBeNull()
  })
})

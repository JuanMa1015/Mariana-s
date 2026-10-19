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

describe("AvisosPush", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("explica y pide el permiso solo cuando el usuario pulsa Activar", async () => {
    push.permisoActual.mockResolvedValue("prompt")
    push.pedirPermiso.mockResolvedValue("granted")
    render(<AvisosPush onAbrirProceso={() => undefined} />)

    expect(await screen.findByText("Activa los avisos en tu celular")).toBeInTheDocument()
    expect(push.pedirPermiso).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Activar avisos" }))
    await waitFor(() => expect(push.activarPush).toHaveBeenCalled())
    expect(screen.queryByRole("region", { name: "Avisos en tu celular" })).not.toBeInTheDocument()
  })

  it("si el permiso ya está concedido se registra sin mostrar el aviso", async () => {
    push.permisoActual.mockResolvedValue("granted")
    render(<AvisosPush onAbrirProceso={() => undefined} />)
    await waitFor(() => expect(push.activarPush).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("si está bloqueado explica cómo habilitarlo y 'Ahora no' lo pospone", async () => {
    push.permisoActual.mockResolvedValue("denied")
    render(<AvisosPush onAbrirProceso={() => undefined} />)
    expect(await screen.findByText("Los avisos están bloqueados")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }))
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    expect(localStorage.getItem("mariana_push_snooze")).not.toBeNull()
  })
})

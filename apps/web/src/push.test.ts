import { expect, it, vi } from "vitest"
import { registrarDispositivo } from "./api"
import { activarPush, escucharPush, estadoRegistroPush } from "./push"

const plugin = vi.hoisted(() => ({
  listeners: new Map<string, (data: { value: string }) => void>(),
  register: vi.fn(async () => undefined),
}))

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    createChannel: vi.fn(async () => undefined),
    register: plugin.register,
    addListener: async (evento: string, callback: (data: { value: string }) => void) => {
      plugin.listeners.set(evento, callback)
      return { remove: async () => { plugin.listeners.delete(evento) } }
    },
  },
}))
vi.mock("./api", () => ({ registrarDispositivo: vi.fn() }))

it("confirma el registro solo después de que la API acepta el token", async () => {
  const desconectar = await escucharPush({ onAviso: vi.fn(), onAbrirProceso: vi.fn() })
  try {
    vi.mocked(registrarDispositivo).mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce({ registered: true })
    await activarPush()
    expect(estadoRegistroPush()).toBe("registrando")
    plugin.listeners.get("registration")?.({ value: "token-de-prueba" })
    await vi.waitFor(() => expect(estadoRegistroPush()).toBe("error"))
    await activarPush()
    plugin.listeners.get("registration")?.({ value: "token-de-prueba" })
    await vi.waitFor(() => expect(estadoRegistroPush()).toBe("registrado"))
  } finally {
    desconectar()
    localStorage.removeItem("mariana_push_token")
  }
})

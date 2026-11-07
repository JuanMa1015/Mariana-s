import { act, screen, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import type { Root } from "react-dom/client"

const native = vi.hoisted(() => ({ atras: () => {}, salir: vi.fn(), quitar: vi.fn(), navegar: vi.fn() }))
let root: Root
vi.mock("react-dom/client", async (original) => {
  const actual = await original<typeof import("react-dom/client")>()
  return { ...actual, createRoot: (...args: Parameters<typeof actual.createRoot>) => { root = actual.createRoot(...args); return root } }
})
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock("@capacitor/app", () => ({ App: {
  addListener: vi.fn((_nombre, callback: () => void) => { native.atras = callback; return Promise.resolve({ remove: native.quitar }) }),
  exitApp: native.salir,
} }))
vi.mock("react-router-dom", async (original) => ({ ...await original<typeof import("react-router-dom")>(), useNavigate: () => native.navegar }))
vi.mock("./components/ProtectedLayout", async () => ({ default: (await import("react-router-dom")).Outlet }))
vi.mock("./App.tsx", () => ({ default: () => <h1>Expedientes de prueba</h1> }))
vi.mock("./sentry", () => ({ initSentry: vi.fn(), captureException: vi.fn() }))
vi.mock("./theme", () => ({ iniciarTema: vi.fn() }))
vi.mock("@vercel/analytics/react", () => ({ Analytics: () => null }))

it("el botón atrás cierra el diálogo, vuelve al expediente o sale desde la raíz", async () => {
  const elemento = document.createElement("div")
  elemento.id = "root"
  document.body.append(elemento)
  window.history.replaceState({ idx: 0 }, "", "/procesos")
  const escape = vi.fn()
  document.addEventListener("keydown", escape)
  try {
    await act(async () => { await import("./main") })
    await screen.findByRole("heading", { name: "Expedientes de prueba" })
    const dialogo = document.createElement("div")
    dialogo.setAttribute("role", "dialog")
    elemento.append(dialogo)
    act(() => native.atras())
    expect(escape).toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }))
    expect(native.salir).not.toHaveBeenCalled()
    dialogo.remove()
    act(() => native.atras())
    expect(native.salir).toHaveBeenCalledOnce()
    await act(async () => {
      window.history.replaceState({ idx: 0 }, "", "/procesos/123")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    act(() => native.atras())
    expect(native.navegar).toHaveBeenLastCalledWith("/procesos", { replace: true })
    window.history.replaceState({ idx: 1 }, "", "/procesos/123")
    act(() => native.atras())
    expect(native.navegar).toHaveBeenLastCalledWith(-1)
  } finally {
    await act(async () => root.unmount())
    await waitFor(() => expect(native.quitar).toHaveBeenCalled())
    document.removeEventListener("keydown", escape)
    elemento.remove()
    window.history.replaceState(null, "", "/")
  }
})

import { beforeEach, expect, it, vi } from "vitest"
import { cerrarSesion } from "./session"
import { logoutUser } from "./api"
import { bajaPush } from "./push"
import { getCache, setCache } from "./api/cache"
import { limpiarAvatar } from "./hooks/useAvatar"

vi.mock("./api", () => ({ logoutUser: vi.fn() }))
vi.mock("./push", () => ({ bajaPush: vi.fn() }))
vi.mock("./hooks/useAvatar", () => ({ limpiarAvatar: vi.fn() }))
beforeEach(() => { vi.resetAllMocks(); localStorage.clear() })

it("limpia los datos de la cuenta aunque falle el cierre remoto y conserva el tema", async () => {
  localStorage.setItem("mariana_tema", "oscuro")
  localStorage.setItem("email", "abogada@example.test")
  setCache("expediente", { privado: true })
  vi.mocked(logoutUser).mockRejectedValueOnce(new Error("sin conexión"))
  await cerrarSesion()
  expect(bajaPush).toHaveBeenCalledOnce()
  expect(vi.mocked(bajaPush).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(logoutUser).mock.invocationCallOrder[0])
  expect(getCache("expediente")).toBeNull()
  expect(localStorage.getItem("email")).toBeNull()
  expect(localStorage.getItem("mariana_tema")).toBe("oscuro")
  expect(limpiarAvatar).toHaveBeenCalledOnce()
})

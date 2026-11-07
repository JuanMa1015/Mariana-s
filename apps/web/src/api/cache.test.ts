import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { clearCache, getCache, setCache, setCacheUser } from "./cache"

beforeEach(() => { localStorage.clear(); clearCache() })
afterEach(() => vi.useRealTimers())

it("caduca los resultados para no presentar consultas antiguas como actuales", () => {
  vi.useFakeTimers()
  setCache("procesos", ["expediente"])
  vi.advanceTimersByTime(5 * 60 * 1000 + 1)
  expect(getCache("procesos")).toBeNull()
})

it("limita la memoria sin eliminar la entrada recién consultada", () => {
  for (let i = 0; i < 61; i++) setCache(`pagina-${i}`, i)
  expect(getCache("pagina-0")).toBeNull()
  expect(getCache("pagina-60")).toBe(60)
})

it("no guarda expedientes en disco y aísla las cuentas", () => {
  setCacheUser("primera@example.test")
  setCache("procesos", [{ alias: "Cliente ficticio" }])
  expect(localStorage.length).toBe(0)
  expect(getCache("procesos")).not.toBeNull()
  setCacheUser("segunda@example.test")
  expect(getCache("procesos")).toBeNull()
})

it("elimina la caché legada y conserva las preferencias", () => {
  localStorage.setItem("mc_novedades", "datos antiguos")
  localStorage.setItem("mariana_tema", "oscuro")
  clearCache()
  expect(localStorage.getItem("mc_novedades")).toBeNull()
  expect(localStorage.getItem("mariana_tema")).toBe("oscuro")
})

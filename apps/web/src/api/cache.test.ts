import { beforeEach, expect, it } from "vitest"
import { clearCache, getCache, setCache, setCacheUser } from "./cache"

beforeEach(() => { localStorage.clear(); clearCache() })

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

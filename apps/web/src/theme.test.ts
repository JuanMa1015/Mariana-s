import { describe, it, expect, beforeEach, vi } from "vitest"
import { aplicarTema, guardarTema, temaGuardado } from "./theme"

describe("tema", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ""
    document.head.innerHTML = '<meta name="theme-color" content="#863bff">'
  })

  it("por defecto sigue al sistema y sin preferencia queda claro", () => {
    expect(temaGuardado()).toBe("sistema")
    aplicarTema("sistema")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("oscuro agrega la clase dark, ajusta color-scheme y se recuerda", () => {
    guardarTema("oscuro")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#0b1120")
    expect(temaGuardado()).toBe("oscuro")
    guardarTema("claro")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("automático usa la preferencia del sistema", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("dark"), addEventListener: () => undefined }))
    expect(aplicarTema("sistema")).toBe(true)
    vi.unstubAllGlobals()
  })
})

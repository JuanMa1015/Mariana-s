import { Capacitor } from "@capacitor/core"

export type Tema = "claro" | "oscuro" | "sistema"

const KEY = "mariana_tema"
const COLOR_BARRA = { claro: "#863bff", oscuro: "#0b1120" }

export function temaGuardado(): Tema {
  try {
    const v = localStorage.getItem(KEY)
    return v === "claro" || v === "oscuro" ? v : "sistema"
  } catch {
    return "sistema"
  }
}

const sistemaEsOscuro = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false

/** Pone o quita la clase `dark` en <html>; los colores oscuros viven en index.css. */
export function aplicarTema(tema: Tema): boolean {
  const oscuro = tema === "oscuro" || (tema === "sistema" && sistemaEsOscuro())
  const el = document.documentElement
  el.classList.toggle("dark", oscuro)
  el.style.colorScheme = oscuro ? "dark" : "light"
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? COLOR_BARRA.oscuro : COLOR_BARRA.claro)
  if (Capacitor.isNativePlatform()) {
    // Iconos claros sobre fondo oscuro y viceversa
    void import("@capacitor/status-bar").then(({ StatusBar, Style }) =>
      StatusBar.setStyle({ style: oscuro ? Style.Dark : Style.Light }).catch(() => undefined),
    )
  }
  return oscuro
}

export function guardarTema(tema: Tema): void {
  try {
    localStorage.setItem(KEY, tema)
  } catch {
    /* sin almacenamiento: el tema solo dura esta sesión */
  }
  aplicarTema(tema)
}

/** Al arrancar: aplica el tema guardado y sigue los cambios del sistema si el modo es «sistema». */
export function iniciarTema(): void {
  aplicarTema(temaGuardado())
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (temaGuardado() === "sistema") aplicarTema("sistema")
  })
}

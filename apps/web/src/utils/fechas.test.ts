import { expect, it } from "vitest"
import { formatearConsulta } from "./fechas"

it("interpreta las consultas UTC sin zona igual que las que sí la incluyen", () => {
  expect(formatearConsulta("2026-11-06T20:30:00")).toBe(formatearConsulta("2026-11-06T20:30:00Z"))
  expect(formatearConsulta("2026-11-06T15:30:00-05:00")).toBe(formatearConsulta("2026-11-06T20:30:00Z"))
  expect(formatearConsulta(null)).toBe("Pendiente")
  expect(formatearConsulta("fecha inválida")).toBe("Fecha no disponible")
})

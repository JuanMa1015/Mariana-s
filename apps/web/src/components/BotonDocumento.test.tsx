import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import BotonDocumento from "./BotonDocumento"
import { descargarDocumento } from "../api"

vi.mock("../api", () => ({ descargarDocumento: vi.fn() }))
const toast = vi.hoisted(() => ({ loading: vi.fn(() => "aviso"), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }))
vi.mock("react-hot-toast", () => ({ default: toast }))
beforeEach(() => vi.clearAllMocks())

it("permite reintentar una descarga fallida", async () => {
  vi.mocked(descargarDocumento).mockRejectedValueOnce(new Error("No hay conexión"))
    .mockResolvedValueOnce("cancelada")
  render(<BotonDocumento id={1} nombre="auto.pdf" />)
  const boton = screen.getByRole("button", { name: "Descargar auto.pdf" })
  fireEvent.click(boton)
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No hay conexión", { id: "aviso" }))
  expect(boton).toBeEnabled()
  fireEvent.click(boton)
  await waitFor(() => expect(toast.dismiss).toHaveBeenCalledWith("aviso"))
  expect(toast.success).not.toHaveBeenCalled()
})

it.each([
  ["descargas-sin-aviso", /activa las notificaciones/],
  ["opciones", /opciones del sistema/],
  ["navegador", /descargas del navegador/],
] as const)("explica el resultado %s sin confundirlo con un aviso publicado", async (resultado, mensaje) => {
  vi.mocked(descargarDocumento).mockResolvedValueOnce(resultado)
  render(<BotonDocumento id={1} nombre="auto.pdf" />)
  fireEvent.click(screen.getByRole("button", { name: "Descargar auto.pdf" }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(mensaje), expect.any(Object)))
})

it("muestra el progreso, evita toques repetidos y confirma el guardado", async () => {
  let terminar!: (resultado: "descargas") => void
  vi.mocked(descargarDocumento).mockReturnValue(new Promise((resolve) => { terminar = resolve }))
  render(<BotonDocumento id={1} nombre="auto.pdf" />)
  const boton = screen.getByRole("button", { name: "Descargar auto.pdf" })
  fireEvent.click(boton)
  fireEvent.click(boton)
  expect(boton).toBeDisabled()
  expect(screen.getByText("Descargando…")).toBeInTheDocument()
  expect(descargarDocumento).toHaveBeenCalledTimes(1)
  terminar("descargas")
  await waitFor(() => expect(boton).toBeEnabled())
  expect(toast.success).toHaveBeenCalledWith("Documento guardado en Descargas.", expect.any(Object))
})

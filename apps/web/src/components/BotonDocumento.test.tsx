import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import BotonDocumento from "./BotonDocumento"
import { descargarDocumento } from "../api"

vi.mock("../api", () => ({ descargarDocumento: vi.fn() }))
const toast = vi.hoisted(() => ({ loading: vi.fn(() => "aviso"), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }))
vi.mock("react-hot-toast", () => ({ default: toast }))

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

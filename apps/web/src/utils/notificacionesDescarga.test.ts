import { beforeEach, expect, it, vi } from "vitest"
import { registerPlugin } from "@capacitor/core"
import { notificarDescarga } from "./notificacionesDescarga"

vi.mock("@capacitor/core", () => ({ registerPlugin: vi.fn() }))
const showDownload = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(registerPlugin).mockReturnValue({ showDownload })
})

it("publica un aviso que permite abrir el archivo guardado", async () => {
  showDownload.mockResolvedValue({ posted: true })
  await expect(notificarDescarga("content://downloads/42", "auto.pdf")).resolves.toBe(true)
  expect(showDownload).toHaveBeenCalledWith({ uri: "content://downloads/42", filename: "auto.pdf" })
})

it("informa que el aviso está bloqueado sin invalidar la descarga", async () => {
  showDownload.mockResolvedValue({ posted: false })
  await expect(notificarDescarga("content://downloads/42", "auto.pdf")).resolves.toBe(false)
})

it("tolera un fallo del complemento nativo", async () => {
  showDownload.mockRejectedValue(new Error("sin permisos"))
  await expect(notificarDescarga("content://downloads/42", "auto.pdf")).resolves.toBe(false)
})

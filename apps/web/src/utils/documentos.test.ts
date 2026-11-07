import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Capacitor } from "@capacitor/core"
import { FileSharer } from "@capgo/capacitor-file-sharer"
import { guardarDocumento } from "./documentos"
import { notificarDescarga } from "./notificacionesDescarga"

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() } }))
vi.mock("@capgo/capacitor-file-sharer", () => ({ FileSharer: { save: vi.fn(), share: vi.fn() } }))
vi.mock("./notificacionesDescarga", () => ({ notificarDescarga: vi.fn() }))

const pdf = () => new Blob(["%PDF-1.7\nDocumento ficticio"], { type: "application/pdf" })
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
  vi.mocked(Capacitor.getPlatform).mockReturnValue("android")
  vi.mocked(FileSharer.save).mockResolvedValue({ uri: "content://descargas/1" })
  vi.mocked(notificarDescarga).mockResolvedValue(true)
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it("guarda el PDF en Descargas a través del plugin nativo", async () => {
  expect(await guardarDocumento(pdf(), "../auto.pdf")).toBe("descargas")
  expect(FileSharer.save).toHaveBeenCalledWith(expect.objectContaining({
    filename: "auto.pdf", contentType: "application/pdf",
    base64Data: expect.stringMatching(/^JVBERi0/),
    android: expect.objectContaining({ saveDirectory: "downloads" }),
  }))
  expect(notificarDescarga).toHaveBeenCalledWith("content://descargas/1", "auto.pdf")
})

it("conserva el archivo guardado cuando las notificaciones están bloqueadas", async () => {
  vi.mocked(notificarDescarga).mockResolvedValue(false)
  expect(await guardarDocumento(pdf(), "auto.pdf")).toBe("descargas-sin-aviso")
  expect(FileSharer.save).toHaveBeenCalledTimes(1)
})

it("ofrece el selector nativo si Android bloquea el guardado directo", async () => {
  vi.mocked(FileSharer.save).mockRejectedValueOnce(new Error("ERR_FILE_SAVE_FAILED"))
  expect(await guardarDocumento(pdf(), "auto.pdf")).toBe("opciones")
  expect(FileSharer.share).toHaveBeenCalledTimes(1)
})

it("respeta la cancelación del selector de iOS", async () => {
  vi.mocked(Capacitor.getPlatform).mockReturnValue("ios")
  vi.mocked(FileSharer.save).mockRejectedValueOnce(new Error("USER_CANCELLED"))
  expect(await guardarDocumento(pdf(), "auto.pdf")).toBe("cancelada")
  expect(FileSharer.share).not.toHaveBeenCalled()
})

it("muestra un error cuando falla el almacenamiento", async () => {
  vi.mocked(FileSharer.save).mockRejectedValueOnce(new Error("ERR_FILE_CACHING_FAILED"))
  await expect(guardarDocumento(pdf(), "auto.pdf")).rejects.toThrow("No se pudo guardar")
})

it("rechaza documentos vacíos antes de invocar el plugin", async () => {
  await expect(guardarDocumento(new Blob(), "auto.pdf")).rejects.toThrow("vacío")
  expect(FileSharer.save).not.toHaveBeenCalled()
})

it("mantiene la descarga web y libera la URL después de entregarla al navegador", async () => {
  vi.useFakeTimers()
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:prueba")
  const liberar = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  expect(await guardarDocumento(pdf(), "auto.pdf")).toBe("navegador")
  expect(click).toHaveBeenCalledTimes(1)
  expect(liberar).not.toHaveBeenCalled()
  vi.advanceTimersByTime(30000)
  expect(liberar).toHaveBeenCalledWith("blob:prueba")
})

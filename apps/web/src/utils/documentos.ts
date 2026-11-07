import { Capacitor } from "@capacitor/core"
import { FileSharer } from "@capgo/capacitor-file-sharer"
import { notificarDescarga } from "./notificacionesDescarga"

export type ResultadoDescarga = "descargas" | "descargas-sin-aviso" | "opciones" | "navegador" | "cancelada"

function base64DelArchivo(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new Error("No se pudo preparar el documento."))
    lector.onload = () => {
      if (typeof lector.result !== "string") return reject(new Error("El documento no es válido."))
      resolve(lector.result.slice(lector.result.indexOf(",") + 1))
    }
    lector.readAsDataURL(blob)
  })
}

/** Conserva la descarga autenticada y entrega únicamente el archivo al sistema. */
export async function guardarDocumento(blob: Blob, nombre: string): Promise<ResultadoDescarga> {
  if (!blob.size) throw new Error("El documento recibido está vacío.")
  const filename = (nombre.split(/[\\/]/).pop() || "documento.pdf")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\p{Cc}/gu, "_")
    .replace(/^\.+/, "_")

  if (Capacitor.isNativePlatform()) {
    const opciones = {
      filename,
      base64Data: await base64DelArchivo(blob),
      contentType: blob.type || "application/pdf",
      title: "Guardar documento",
      android: { saveDirectory: "downloads" as const, chooserTitle: "Abrir o guardar documento" },
    }
    try {
      const guardado = await FileSharer.save(opciones)
      if (Capacitor.getPlatform() !== "android") return "opciones"
      const notificada = guardado.uri && await notificarDescarga(guardado.uri, filename)
      return notificada ? "descargas" : "descargas-sin-aviso"
    } catch (error) {
      const codigo = error instanceof Error ? error.message : String(error)
      if (codigo === "USER_CANCELLED") return "cancelada"
      // Android anterior a 10 puede requerir acceso al almacenamiento público.
      // El selector nativo permite entregar el archivo sin ampliar esos permisos.
      if (Capacitor.getPlatform() === "android" && codigo === "ERR_FILE_SAVE_FAILED") {
        await FileSharer.share(opciones)
        return "opciones"
      }
      throw new Error("No se pudo guardar el documento en el dispositivo. Vuelve a intentar.", { cause: error })
    }
  }

  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = filename
  document.body.appendChild(enlace)
  try {
    enlace.click()
  } finally {
    enlace.remove()
    // El navegador necesita consumir la URL antes de que se libere.
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
  return "navegador"
}

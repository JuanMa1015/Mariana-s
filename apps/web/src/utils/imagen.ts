const LADO = 256

/** Recorta al centro en cuadrado y reduce a 256 px (JPEG): la foto queda en ~20-40 KB. */
export async function redimensionarAvatar(archivo: File, lado = LADO): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" })
  const corte = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = lado
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Tu navegador no puede procesar la imagen")
  ctx.fillStyle = "#fff" // los PNG con transparencia quedan sobre blanco al pasar a JPEG
  ctx.fillRect(0, 0, lado, lado)
  ctx.drawImage(bitmap, (bitmap.width - corte) / 2, (bitmap.height - corte) / 2, corte, corte, 0, 0, lado, lado)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", 0.85),
  )
}

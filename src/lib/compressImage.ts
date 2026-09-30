/**
 * Shrinks a photo in the browser before upload so listings stay light on Storage
 * and on students' data: max 1600px on the long edge, re-encoded as JPEG, quality
 * lowered (then size reduced) until the file is under `maxBytes`.
 */
export async function compressImage(
  file: File,
  maxBytes = 300 * 1024,
  maxDimension = 1600,
): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`Could not read ${file.name}. Try a JPG or PNG.`)
  }

  let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser cannot process images.')

  const encode = (quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

  let best: Blob | null = null
  for (let round = 0; round < 6; round++) {
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    ctx.fillStyle = '#fff' // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
      const blob = await encode(q)
      if (!blob) throw new Error('Could not compress the image.')
      best = blob
      if (blob.size <= maxBytes) {
        bitmap.close()
        return blob
      }
    }
    scale *= 0.8 // still too big: shrink dimensions and try again
  }
  bitmap.close()
  if (best && best.size <= maxBytes * 1.5) return best
  throw new Error(`${file.name} is too detailed to compress under ${Math.round(maxBytes / 1024)} KB.`)
}

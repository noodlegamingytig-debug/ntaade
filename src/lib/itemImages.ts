import { supabase } from './supabaseClient'
import { compressImage } from './compressImage'

const BUCKET = 'item-images'

export interface StagedImage {
  id: string
  blob: Blob
  previewUrl: string
}

/** Compress picked files; failures are returned as messages so one bad file doesn't sink the batch. */
export async function prepareImages(files: File[]): Promise<{ ok: StagedImage[]; errors: string[] }> {
  const ok: StagedImage[] = []
  const errors: string[] = []
  for (const file of files) {
    try {
      const blob = await compressImage(file)
      ok.push({ id: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) })
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Could not process ${file.name}.`)
    }
  }
  return { ok, errors }
}

/** Upload already-compressed images for an item and record them in item_images. */
export async function uploadItemImages(itemId: string, images: StagedImage[], startPosition: number): Promise<void> {
  const rows: { item_id: string; storage_path: string; position: number }[] = []
  for (const [i, img] of images.entries()) {
    const path = `${itemId}/${img.id}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, img.blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    rows.push({ item_id: itemId, storage_path: path, position: startPosition + i })
  }
  if (rows.length) {
    const { error } = await supabase.from('item_images').insert(rows)
    if (error) throw new Error(error.message)
  }
}

/** Remove Storage objects for the given item_images paths (skips external URLs such as seed placeholders). */
export async function removeStoredFiles(paths: string[]): Promise<void> {
  const real = paths.filter((p) => !/^https?:\/\//i.test(p))
  if (real.length) await supabase.storage.from(BUCKET).remove(real)
}

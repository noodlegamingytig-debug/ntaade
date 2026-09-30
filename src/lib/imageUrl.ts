const STORAGE_BUCKET = 'item-images'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

/**
 * Resolves an item_images.storage_path into a URL the <img> tag can use.
 * Seed data uses full external URLs (picsum.photos) so the catalog has
 * something to render before real photos are uploaded — those are
 * rendered as-is. A real Storage path (no scheme) is resolved against
 * the public "item-images" bucket.
 */
export function resolveImageUrl(storagePath: string): string {
  if (/^https?:\/\//i.test(storagePath)) {
    return storagePath
  }
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`
}

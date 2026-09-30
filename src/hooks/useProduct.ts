import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CatalogItem } from '../types/catalog'

export function useProduct(id: string | undefined) {
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [settledId, setSettledId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Loading is derived: we're loading until a fetch for the *current* id has settled.
  const loading = settledId !== id

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function run() {
      const [{ data: row, error: itemError }, { data: imgRows, error: imgError }] =
        await Promise.all([
          supabase.from('items_public').select('*').eq('id', id!).maybeSingle(),
          supabase
            .from('item_images')
            .select('storage_path')
            .eq('item_id', id!)
            .order('position', { ascending: true }),
        ])

      if (itemError) throw itemError
      if (imgError) throw imgError
      if (!row) {
        return { item: null, images: [] as string[] }
      }

      const { data: prices, error: priceError } = await supabase.rpc('get_effective_prices', {
        p_item_ids: [row.id],
        p_promo_code: null,
      })
      if (priceError) throw priceError
      const price = prices?.[0]

      const catalogItem: CatalogItem = {
        id: row.id,
        title: row.title,
        description: row.description,
        categoryId: row.category_id,
        categoryName: row.category_name,
        categorySlug: row.category_slug,
        department: row.department,
        size: row.size,
        measurements: row.measurements,
        conditionGrade: row.condition_grade,
        basePriceGhs: row.base_price_ghs,
        unitPriceGhs: price?.unit_price_ghs ?? row.current_price_ghs,
        discountGhs:
          price?.discount_ghs ?? Math.max(row.base_price_ghs - row.current_price_ghs, 0),
        isOnSale: price?.is_on_sale ?? row.is_on_sale,
        promoName: price?.promo_name ?? null,
        createdAt: row.created_at,
        imageUrl: imgRows?.[0]?.storage_path ?? null,
        imageCount: imgRows?.length ?? 0,
      }

      return { item: catalogItem, images: (imgRows ?? []).map((r) => r.storage_path) }
    }

    run()
      .then((result) => {
        if (cancelled) return
        setError(null)
        if (!result.item) {
          setItem(null)
          setNotFound(true)
        } else {
          setNotFound(false)
          setItem(result.item)
          setImages(result.images)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load this item.')
      })
      .finally(() => {
        if (!cancelled) setSettledId(id)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return { item, images, loading, error, notFound }
}

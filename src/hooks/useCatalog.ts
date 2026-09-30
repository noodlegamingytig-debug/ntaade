import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CatalogFilters, CatalogItem } from '../types/catalog'
import { descendantCategoryIds, type Category } from './useCategories'

/**
 * Fetches the catalog for the given filters.
 *
 * Department/category/size/condition/search/price-range are applied as
 * database filters against items_public (cheap, indexed). "On sale only"
 * and the chosen sort are then applied client-side, AFTER enriching each
 * item with its true effective price via the get_effective_prices RPC —
 * that RPC is what accounts for promotions on top of an item's own sale
 * price, so it's the only accurate source for "is this actually
 * discounted right now" and "which is the biggest discount". The catalog
 * is small (a few dozen items at most), so fetching the filtered set in
 * full and sorting/faceting in the browser is simpler than paginating
 * and is not a real performance concern at this scale.
 */
export function useCatalog(filters: CatalogFilters, categories: Category[]) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function run() {
      let query = supabase.from('items_public').select('*')

      if (filters.department) {
        query = query.eq('department', filters.department)
      }
      if (filters.categoryId) {
        const ids = descendantCategoryIds(categories, filters.categoryId)
        query = query.in('category_id', ids)
      }
      if (filters.size) {
        query = query.eq('size', filters.size)
      }
      if (filters.conditionGrade) {
        query = query.eq('condition_grade', filters.conditionGrade)
      }
      if (filters.minPrice != null) {
        query = query.gte('current_price_ghs', filters.minPrice)
      }
      if (filters.maxPrice != null) {
        query = query.lte('current_price_ghs', filters.maxPrice)
      }
      if (filters.search.trim()) {
        const q = filters.search.trim().replace(/[%,]/g, '')
        query = query.or(
          `title.ilike.%${q}%,description.ilike.%${q}%,category_name.ilike.%${q}%`,
        )
      }

      const { data: itemRows, error: itemsError } = await query
      if (itemsError) throw itemsError
      const rows = itemRows ?? []
      if (rows.length === 0) return []

      const ids = rows.map((r) => r.id)

      const [{ data: images, error: imagesError }, { data: prices, error: pricesError }] =
        await Promise.all([
          supabase
            .from('item_images')
            .select('item_id, storage_path, position')
            .in('item_id', ids)
            .order('position', { ascending: true }),
          supabase.rpc('get_effective_prices', { p_item_ids: ids, p_promo_code: null }),
        ])
      if (imagesError) throw imagesError
      if (pricesError) throw pricesError

      const firstImageByItem = new Map<string, string>()
      const imageCountByItem = new Map<string, number>()
      for (const img of images ?? []) {
        imageCountByItem.set(img.item_id, (imageCountByItem.get(img.item_id) ?? 0) + 1)
        if (!firstImageByItem.has(img.item_id)) {
          firstImageByItem.set(img.item_id, img.storage_path)
        }
      }

      const priceByItem = new Map((prices ?? []).map((p) => [p.item_id, p]))

      let enriched: CatalogItem[] = rows.map((row) => {
        const price = priceByItem.get(row.id)
        const unitPrice = price?.unit_price_ghs ?? row.current_price_ghs
        const discount = price?.discount_ghs ?? Math.max(row.base_price_ghs - row.current_price_ghs, 0)
        return {
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
          unitPriceGhs: unitPrice,
          discountGhs: discount,
          isOnSale: price?.is_on_sale ?? row.is_on_sale,
          promoName: price?.promo_name ?? null,
          createdAt: row.created_at,
          imageUrl: firstImageByItem.get(row.id) ?? null,
          imageCount: imageCountByItem.get(row.id) ?? 0,
        }
      })

      if (filters.onSaleOnly) {
        enriched = enriched.filter((item) => item.discountGhs > 0.001)
      }

      enriched.sort((a, b) => {
        switch (filters.sort) {
          case 'price_asc':
            return a.unitPriceGhs - b.unitPriceGhs
          case 'price_desc':
            return b.unitPriceGhs - a.unitPriceGhs
          case 'discount_desc':
            return b.discountGhs - a.discountGhs
          case 'newest':
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
      })

      return enriched
    }

    run()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load items.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.department,
    filters.categoryId,
    filters.size,
    filters.conditionGrade,
    filters.minPrice,
    filters.maxPrice,
    filters.search,
    filters.onSaleOnly,
    filters.sort,
    categories,
  ])

  return { items, loading, error }
}

/** Distinct sizes across all available items, for the size filter's
 * options — fetched once, unfiltered by the other facets (a simple,
 * static facet list rather than one that narrows as other filters are
 * applied). */
export function useAvailableSizes() {
  const [sizes, setSizes] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('items_public')
      .select('size')
      .not('size', 'is', null)
      .then(({ data }) => {
        if (cancelled || !data) return
        const unique = Array.from(new Set(data.map((r) => r.size).filter(Boolean))) as string[]
        unique.sort((a, b) => a.localeCompare(b))
        setSizes(unique)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return sizes
}

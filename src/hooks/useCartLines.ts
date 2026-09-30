import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CartLine } from '../types/cart'

/**
 * Prices and availability for the ids in the cart, computed by the database
 * (get_cart_lines) so promos and sale prices match what checkout will charge.
 * Works for guests. An id the database no longer knows about comes back as an
 * unavailable placeholder line so the student can remove it.
 */
export function useCartLines(itemIds: string[], promoCode: string | null) {
  const [refreshTick, setRefreshTick] = useState(0)
  const [state, setState] = useState<{ key: string; lines: CartLine[]; error: string | null } | null>(null)

  const key = `${itemIds.join(',')}|${promoCode ?? ''}|${refreshTick}`

  useEffect(() => {
    if (itemIds.length === 0) return
    let cancelled = false
    supabase
      .rpc('get_cart_lines', { p_item_ids: itemIds, p_promo_code: promoCode })
      .then(({ data, error }) => {
        if (cancelled) return
        const byId = new Map((data ?? []).map((r) => [r.item_id, r]))
        const lines: CartLine[] = itemIds.map((id) => {
          const r = byId.get(id)
          if (!r) {
            return {
              itemId: id, title: 'This item is no longer listed', size: null, conditionGrade: null,
              isAvailable: false, imagePath: null, basePriceGhs: 0, unitPriceGhs: 0, discountGhs: 0, promoName: null,
            }
          }
          return {
            itemId: r.item_id, title: r.title, size: r.size, conditionGrade: r.condition_grade,
            isAvailable: r.is_available, imagePath: r.image_path, basePriceGhs: r.base_price_ghs,
            unitPriceGhs: r.unit_price_ghs, discountGhs: r.discount_ghs, promoName: r.promo_name,
          }
        })
        setState({ key, lines, error: error?.message ?? null })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  const lines = useMemo(
    () => (itemIds.length === 0 || !state ? [] : state.lines.filter((l) => itemIds.includes(l.itemId))),
    [itemIds, state],
  )
  const loading = itemIds.length > 0 && state?.key !== key
  const error = itemIds.length > 0 && state?.key === key ? state.error : null

  const available = lines.filter((l) => l.isAvailable)
  const unavailable = lines.filter((l) => !l.isAvailable)
  const subtotal = available.reduce((sum, l) => sum + l.basePriceGhs, 0)
  const discount = available.reduce((sum, l) => sum + l.discountGhs, 0)

  return { lines, available, unavailable, subtotal, discount, loading, error, refresh }
}

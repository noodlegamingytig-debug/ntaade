import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { CartContext, type CartContextValue } from './cartContext'

const GUEST_KEY = 'ntaade.cart.v1'
const PROMO_KEY = 'ntaade.promo.v1'

function readGuest(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeGuest(ids: string[]) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(ids))
  } catch {
    /* storage unavailable (private mode etc.) — cart just won't persist */
  }
}

function readPromo(): string | null {
  try {
    return sessionStorage.getItem(PROMO_KEY)
  } catch {
    return null
  }
}

/**
 * Cart state.
 *  - Guests: ids live in localStorage.
 *  - Signed in: ids live in the cart_items table, so the cart follows the student across
 *    devices. When a guest signs in, their browser cart is merged into the database cart.
 * Adding to a cart never reserves anything — reservation only happens at checkout.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [guestIds, setGuestIds] = useState<string[]>(readGuest)
  const [dbState, setDbState] = useState<{ userId: string; ids: string[] } | null>(null)
  const [promoCode, setPromoCodeState] = useState<string | null>(readPromo)

  // Persist the guest cart whenever it changes (only while signed out).
  useEffect(() => {
    if (!userId) writeGuest(guestIds)
  }, [guestIds, userId])

  const loadDbCart = useCallback(async (uid: string) => {
    const { data } = await supabase.from('cart_items').select('item_id, added_at').order('added_at')
    setDbState({ userId: uid, ids: (data ?? []).map((r) => r.item_id) })
  }, [])

  // On sign-in: merge any guest cart into the database cart, then load it.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const local = readGuest()
      if (local.length > 0) {
        // Only merge ids that still exist, so one stale id can't make the whole merge fail.
        const { data: valid } = await supabase.rpc('get_cart_lines', { p_item_ids: local })
        const validIds = (valid ?? []).map((l) => l.item_id)
        if (validIds.length > 0) {
          await supabase
            .from('cart_items')
            .upsert(
              validIds.map((item_id) => ({ student_id: userId, item_id })),
              { onConflict: 'student_id,item_id', ignoreDuplicates: true },
            )
        }
        writeGuest([])
        if (!cancelled) setGuestIds([])
      }
      if (!cancelled) await loadDbCart(userId)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, loadDbCart])

  const itemIds = useMemo(() => {
    if (!userId) return guestIds
    return dbState && dbState.userId === userId ? dbState.ids : []
  }, [userId, guestIds, dbState])

  const add = useCallback(
    async (id: string) => {
      if (!userId) {
        setGuestIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        return
      }
      setDbState((s) => (s && s.userId === userId && !s.ids.includes(id) ? { ...s, ids: [...s.ids, id] } : s))
      const { error } = await supabase
        .from('cart_items')
        .upsert({ student_id: userId, item_id: id }, { onConflict: 'student_id,item_id', ignoreDuplicates: true })
      if (error) {
        setDbState((s) => (s && s.userId === userId ? { ...s, ids: s.ids.filter((x) => x !== id) } : s))
        throw error
      }
    },
    [userId],
  )

  const removeMany = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      if (!userId) {
        setGuestIds((prev) => prev.filter((x) => !ids.includes(x)))
        return
      }
      setDbState((s) => (s && s.userId === userId ? { ...s, ids: s.ids.filter((x) => !ids.includes(x)) } : s))
      const { error } = await supabase.from('cart_items').delete().in('item_id', ids)
      if (error) {
        await loadDbCart(userId)
        throw error
      }
    },
    [userId, loadDbCart],
  )

  const remove = useCallback((id: string) => removeMany([id]), [removeMany])

  const reload = useCallback(async () => {
    if (userId) await loadDbCart(userId)
  }, [userId, loadDbCart])

  const setPromoCode = useCallback((code: string | null) => {
    setPromoCodeState(code)
    try {
      if (code) sessionStorage.setItem(PROMO_KEY, code)
      else sessionStorage.removeItem(PROMO_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const value: CartContextValue = useMemo(
    () => ({
      itemIds,
      count: itemIds.length,
      has: (id: string) => itemIds.includes(id),
      add,
      remove,
      removeMany,
      reload,
      promoCode,
      setPromoCode,
    }),
    [itemIds, add, remove, removeMany, reload, promoCode, setPromoCode],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

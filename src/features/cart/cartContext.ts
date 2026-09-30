import { createContext } from 'react'

export interface CartContextValue {
  /** Item ids in the cart. Guests: browser storage. Signed in: the cart_items table. */
  itemIds: string[]
  count: number
  has: (id: string) => boolean
  add: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  removeMany: (ids: string[]) => Promise<void>
  /** Re-read the signed-in cart from the database (e.g. after checkout empties it). */
  reload: () => Promise<void>
  promoCode: string | null
  setPromoCode: (code: string | null) => void
}

export const CartContext = createContext<CartContextValue | null>(null)

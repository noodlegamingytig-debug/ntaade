import { useContext } from 'react'
import { CartContext } from '../features/cart/cartContext'

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}

import { orderStatusLabel } from '../../lib/orderStatus'
import type { OrderStatus } from '../../types/database'

export function StatusPill({ status, hasReference = false }: { status: OrderStatus; hasReference?: boolean }) {
  const good = status === 'paid' || status === 'delivered'
  const bad = status === 'cancelled' || status === 'expired' || status === 'refunded'
  const cls = good
    ? 'bg-brand-gray-900 text-white'
    : bad
      ? 'bg-brand-gray-100 text-brand-gray-500'
      : 'bg-brand-red-light text-brand-red-dark'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {orderStatusLabel(status, hasReference)}
    </span>
  )
}

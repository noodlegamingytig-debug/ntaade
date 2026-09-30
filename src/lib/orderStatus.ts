import type { OrderStatus } from '../types/database'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  expired: 'Expired',
}

export function orderStatusLabel(status: OrderStatus, hasReference: boolean): string {
  if (status === 'awaiting_payment' && hasReference) return 'Payment submitted'
  return ORDER_STATUS_LABELS[status]
}

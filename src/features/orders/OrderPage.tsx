import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { ErrorState } from '../../components/ui/ErrorState'
import { StatusPill } from '../../components/ui/StatusPill'
import { formatDate, formatDateTime, formatRemaining } from '../../lib/dates'
import { formatGhs } from '../../lib/format'
import { supabase } from '../../lib/supabaseClient'
import { useNow } from '../../hooks/useNow'
import { useToast } from '../../hooks/useToast'
import type { OrderBatchRow, OrderItemRow, OrderRow } from '../../types/database'
import { PaymentInstructions } from '../checkout/PaymentInstructions'

interface Loaded {
  id: string
  order: OrderRow | null
  items: OrderItemRow[]
  batch: OrderBatchRow | null
  error: string | null
}

export function OrderPage() {
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const now = useNow(1000)
  const [tick, setTick] = useState(0)
  const [data, setData] = useState<(Loaded & { tick: number }) | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
      if (cancelled) return
      if (error || !order) {
        return setData({ id, order: null, items: [], batch: null, error: error?.message ?? null, tick })
      }
      const [{ data: items }, { data: batch }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', id).order('title_snapshot'),
        supabase.from('order_batches').select('*').eq('id', order.batch_id).maybeSingle(),
      ])
      if (!cancelled) setData({ id, order, items: items ?? [], batch, error: null, tick })
    })()
    return () => {
      cancelled = true
    }
  }, [id, tick])

  const reload = () => setTick((t) => t + 1)

  async function submitReference(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setBusy(true)
    setActionError(null)
    const { error } = await supabase.rpc('submit_payment_reference', { p_order_id: id, p_reference: reference })
    setBusy(false)
    if (error) return setActionError(error.message)
    setReference('')
    showToast("Thanks — we'll confirm your payment shortly.")
    reload()
  }

  async function cancelOrder() {
    if (!id) return
    setBusy(true)
    setActionError(null)
    const { error } = await supabase.rpc('cancel_order', { p_order_id: id })
    setBusy(false)
    setConfirmCancel(false)
    if (error) return setActionError(error.message)
    showToast('Order cancelled. The items are back on sale.')
    reload()
  }

  if (!data || data.id !== id) {
    return <div className="mx-auto max-w-3xl animate-pulse space-y-3 px-4 py-8"><div className="h-6 w-1/2 rounded bg-brand-gray-100" /><div className="h-32 rounded bg-brand-gray-100" /></div>
  }
  if (data.error) {
    return <div className="mx-auto max-w-3xl px-4 py-8"><ErrorState message={data.error} onRetry={reload} /></div>
  }
  const { order, items, batch } = data
  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-brand-gray-900">We couldn't find that order.</p>
        <Link to="/orders" className="mt-4 inline-block rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark">My orders</Link>
      </div>
    )
  }

  const code = `#${order.id.slice(0, 8).toUpperCase()}`
  const awaiting = order.status === 'awaiting_payment'
  const remainingMs = new Date(order.hold_expires_at).getTime() - now
  const holdOver = remainingMs <= 0
  const hasRef = !!order.payment_reference

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'My orders', to: '/orders' }, { label: code }]} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-brand-gray-900">Order {code}</h1>
        <StatusPill status={order.status} hasReference={hasRef} />
      </div>
      <p className="mb-6 text-sm text-brand-gray-500">Placed {formatDateTime(order.created_at)}</p>

      {awaiting && !hasRef && !holdOver && (
        <div className="mb-6 space-y-4">
          <div className="rounded-lg bg-brand-red-light px-4 py-3 text-sm text-brand-red-dark">
            Your items are on hold for <strong>{formatRemaining(remainingMs)}</strong>. Pay before then to keep them.
          </div>
          <PaymentInstructions amount={order.total_ghs} />
          <form onSubmit={submitReference} className="rounded-lg border border-brand-gray-200 p-4">
            <label htmlFor="ref" className="block text-sm font-medium text-brand-gray-900">Transaction reference</label>
            <p className="text-xs text-brand-gray-500">From your mobile money confirmation message, after you've paid.</p>
            <div className="mt-2 flex gap-2">
              <input
                id="ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-brand-gray-300 px-3 py-2.5 text-sm uppercase placeholder:normal-case focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                placeholder="e.g. MP240930.1234.A56789"
              />
              <button type="submit" disabled={busy || reference.trim().length < 4} className="rounded-full bg-brand-red px-5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50">
                {busy ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {awaiting && hasRef && (
        <div className="mb-6 rounded-lg bg-brand-gray-50 px-4 py-3 text-sm text-brand-gray-700">
          We have your payment reference <strong>{order.payment_reference}</strong> and will confirm it shortly. Your items are held for you.
        </div>
      )}

      {awaiting && !hasRef && holdOver && (
        <div className="mb-6 rounded-lg bg-brand-gray-50 px-4 py-3 text-sm text-brand-gray-700">
          The 24-hour hold on this order has run out, so the items may already be back on sale. If you did pay, message us with your reference.
        </div>
      )}

      {order.status === 'expired' && (
        <div className="mb-6 rounded-lg bg-brand-gray-50 px-4 py-3 text-sm text-brand-gray-700">
          This order expired because payment wasn't received within 24 hours. The items went back on sale.
        </div>
      )}
      {order.status === 'paid' && (
        <div className="mb-6 rounded-lg bg-brand-gray-50 px-4 py-3 text-sm text-brand-gray-700">Payment confirmed. We'll have your order ready for pickup.</div>
      )}

      {actionError && <p role="alert" className="mb-4 rounded-lg bg-brand-red-light px-3 py-2 text-sm text-brand-red-dark">{actionError}</p>}

      <section className="rounded-lg border border-brand-gray-200">
        <ul className="divide-y divide-brand-gray-100">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">{it.title_snapshot}</span>
              <span className="shrink-0 font-medium">{formatGhs(it.price_paid_ghs)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-brand-gray-200 px-4 py-3 text-sm">
          <div className="flex justify-between"><dt className="text-brand-gray-600">Subtotal</dt><dd>{formatGhs(order.subtotal_ghs)}</dd></div>
          {order.discount_total_ghs > 0.001 && (
            <div className="flex justify-between text-brand-red-dark"><dt>Discounts{order.promo_code ? ` (${order.promo_code})` : ''}</dt><dd>−{formatGhs(order.discount_total_ghs)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-brand-gray-600">Delivery</dt><dd>{order.delivery_fee_ghs > 0 ? formatGhs(order.delivery_fee_ghs) : 'Free'}</dd></div>
          <div className="flex justify-between border-t border-brand-gray-100 pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatGhs(order.total_ghs)}</dd></div>
        </dl>
      </section>

      {batch && (
        <section className="mt-4 rounded-lg border border-brand-gray-200 px-4 py-3 text-sm">
          <h2 className="font-semibold text-brand-gray-900">Pickup</h2>
          <p className="mt-1 text-brand-gray-700">
            {batch.delivery_date ? formatDate(batch.delivery_date) : 'Date to be confirmed'}
            {batch.pickup_point && <> · {batch.pickup_point}</>}
          </p>
        </section>
      )}

      {awaiting && !hasRef && (
        <div className="mt-6">
          {confirmCancel ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>Cancel this order and release the items?</span>
              <button type="button" disabled={busy} onClick={cancelOrder} className="rounded-full bg-brand-red px-4 py-1.5 font-semibold text-white hover:bg-brand-red-dark">Yes, cancel</button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="text-brand-gray-500 hover:underline">Keep order</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmCancel(true)} className="text-sm text-brand-gray-500 hover:text-brand-red hover:underline">Cancel order</button>
          )}
        </div>
      )}
    </div>
  )
}

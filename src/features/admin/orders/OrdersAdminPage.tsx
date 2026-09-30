import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useNow } from '../../../hooks/useNow'
import { StatusPill } from '../../../components/ui/StatusPill'
import { supabase } from '../../../lib/supabaseClient'
import { unwrap, useAdminQuery } from '../../../hooks/useAdminQuery'
import { useToast } from '../../../hooks/useToast'
import { formatDateTime } from '../../../lib/dates'
import { formatGhs } from '../../../lib/format'
import type { AdminOrder, OrderStatus } from '../../../types/database'
import { Loading, PageHeader, QueryError } from '../AdminUi'
import { dangerBtn, primaryBtn, secondaryBtn, smallInputCls } from '../adminStyles'

const TABS = [
  { id: 'review', label: 'To confirm' },
  { id: 'unpaid', label: 'Awaiting payment' },
  { id: 'paid', label: 'Paid' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'closed', label: 'Cancelled / refunded' },
  { id: 'all', label: 'All' },
] as const
type Tab = (typeof TABS)[number]['id']

function inTab(o: AdminOrder, tab: Tab): boolean {
  switch (tab) {
    case 'review': return o.status === 'awaiting_payment' && !!o.payment_reference
    case 'unpaid': return o.status === 'awaiting_payment' && !o.payment_reference
    case 'paid': return o.status === 'paid'
    case 'delivered': return o.status === 'delivered'
    case 'closed': return ['cancelled', 'refunded', 'expired'].includes(o.status)
    default: return true
  }
}

type Action = { kind: 'status'; status: OrderStatus } | { kind: 'reject' }

export function OrdersAdminPage() {
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'review') as Tab
  const [batchId, setBatchId] = useState('')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<{ orderId: string; action: Action; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useNow(30000)

  const { data, error, loading, refreshing, reload } = useAdminQuery(async () => {
    const [orders, batches] = await Promise.all([
      supabase.rpc('admin_list_orders', { p_batch_id: batchId || null, p_status: null }),
      supabase.from('order_batches').select('*').order('closes_at', { ascending: false }),
    ])
    return { orders: unwrap(orders), batches: unwrap(batches) }
  }, `orders:${batchId}`)

  if (error && !data) return <QueryError message={error} onRetry={reload} />
  if (loading || !data) return <Loading />

  const needle = search.trim().toLowerCase()
  const matches = (o: AdminOrder) =>
    !needle ||
    [o.student_name, o.student_email, o.student_phone, o.payment_reference, ...o.items.map((i) => i.title)]
      .some((v) => v?.toLowerCase().includes(needle))
  const counts = Object.fromEntries(TABS.map((t) => [t.id, data.orders.filter((o) => inTab(o, t.id)).length])) as Record<Tab, number>
  const rows = data.orders.filter((o) => inTab(o, tab) && matches(o))

  async function perform() {
    if (!pending) return
    setBusy(true)
    const { orderId, action } = pending
    const res = action.kind === 'reject'
      ? await supabase.rpc('admin_reject_payment', { p_order_id: orderId })
      : await supabase.rpc('admin_set_order_status', { p_order_id: orderId, p_status: action.status })
    setBusy(false)
    setPending(null)
    if (res.error) showToast(res.error.message)
    else showToast('Order updated')
    reload()
  }

  function ask(o: AdminOrder, action: Action, label: string) {
    setPending({ orderId: o.id, action, label })
  }

  return (
    <div>
      <PageHeader title="Orders">
        <select aria-label="Filter by batch" className={smallInputCls} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">All batches</option>
          {data.batches.map((b) => (
            <option key={b.id} value={b.id}>{b.delivery_date ?? 'No date'} · {b.pickup_point ?? 'No pickup point'} ({b.status})</option>
          ))}
        </select>
      </PageHeader>

      <div className="-mx-4 mb-3 overflow-x-auto px-4">
        <div role="tablist" className="flex gap-2 whitespace-nowrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              onClick={() => setParams({ tab: t.id }, { replace: true })}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                tab === t.id ? 'border-brand-red bg-brand-red text-white' : 'border-brand-gray-300 text-brand-gray-700 hover:border-brand-gray-500'
              }`}
            >
              {t.label} <span className={tab === t.id ? 'text-white/80' : 'text-brand-gray-500'}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <input aria-label="Search orders" placeholder="Search name, email, phone, reference or item…" className={`${smallInputCls} mb-4 w-full`} value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className={`space-y-3 ${refreshing ? 'opacity-70' : ''}`}>
        {rows.map((o) => {
          const hasRef = !!o.payment_reference
          const lapsed = o.status === 'awaiting_payment' && !hasRef && new Date(o.hold_expires_at).getTime() < now
          const confirming = pending?.orderId === o.id
          return (
            <article key={o.id} className="rounded-lg border border-brand-gray-200 p-4" aria-label={`Order for ${o.student_name ?? o.student_email}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-gray-900">{o.student_name || '(no name)'}</p>
                  <p className="text-xs text-brand-gray-500">
                    {o.student_email}{o.student_phone && <> · <a className="underline" href={`tel:${o.student_phone}`}>{o.student_phone}</a></>}
                  </p>
                  <p className="text-xs text-brand-gray-500">Placed {formatDateTime(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <StatusPill status={o.status} hasReference={hasRef} />
                  <p className="mt-1 text-base font-semibold">{formatGhs(o.total_ghs)}</p>
                </div>
              </div>

              <ul className="mt-3 divide-y divide-brand-gray-100 text-sm">
                {o.items.map((i) => (
                  <li key={i.item_id} className="flex justify-between gap-3 py-1">
                    <span className="min-w-0">
                      {i.title}
                      {i.vendor && <span className="ml-2 text-xs text-brand-gray-400">{i.vendor}</span>}
                    </span>
                    <span className="shrink-0 text-brand-gray-700">{formatGhs(i.price)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-brand-gray-500">
                Items {formatGhs(o.subtotal_ghs - o.discount_total_ghs)}
                {o.delivery_fee_ghs > 0 && <> + delivery {formatGhs(o.delivery_fee_ghs)}</>}
                {o.promo_code && <> · code {o.promo_code}</>}
              </p>

              {hasRef && (
                <p className="mt-2 rounded-md bg-brand-gray-100 px-3 py-2 text-sm">
                  MoMo reference: <span className="font-mono font-semibold">{o.payment_reference}</span>
                </p>
              )}
              {lapsed && <p className="mt-2 text-xs text-brand-red-dark">Hold time is up — this will expire soon unless they pay.</p>}

              {confirming ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-brand-red-light/50 px-3 py-2 text-sm">
                  <span className="font-medium text-brand-gray-900">{pending.label}?</span>
                  <button type="button" className={primaryBtn} disabled={busy} onClick={perform}>{busy ? 'Working…' : 'Yes'}</button>
                  <button type="button" className={secondaryBtn} disabled={busy} onClick={() => setPending(null)}>No</button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.status === 'awaiting_payment' && hasRef && (
                    <>
                      <button type="button" className={primaryBtn} onClick={() => ask(o, { kind: 'status', status: 'paid' }, `Confirm ${formatGhs(o.total_ghs)} received`)}>Confirm payment</button>
                      <button type="button" className={secondaryBtn} onClick={() => ask(o, { kind: 'reject' }, 'Reject this reference (student can resubmit)')}>Reject reference</button>
                    </>
                  )}
                  {o.status === 'awaiting_payment' && !hasRef && (
                    <button type="button" className={secondaryBtn} onClick={() => ask(o, { kind: 'status', status: 'paid' }, 'Mark as paid (cash / paid outside the app)')}>Mark paid</button>
                  )}
                  {o.status === 'paid' && (
                    <button type="button" className={primaryBtn} onClick={() => ask(o, { kind: 'status', status: 'delivered' }, 'Mark as delivered')}>Mark delivered</button>
                  )}
                  {o.status === 'expired' && (
                    <button type="button" className={secondaryBtn} onClick={() => ask(o, { kind: 'status', status: 'paid' }, 'Restore as paid (only works if the items are still free)')}>Restore as paid</button>
                  )}
                  {(o.status === 'awaiting_payment' || o.status === 'paid') && (
                    <button type="button" className={dangerBtn} onClick={() => ask(o, { kind: 'status', status: 'cancelled' }, 'Cancel and put the items back on sale')}>Cancel order</button>
                  )}
                  {(o.status === 'paid' || o.status === 'delivered') && (
                    <button type="button" className={dangerBtn} onClick={() => ask(o, { kind: 'status', status: 'refunded' }, o.status === 'paid' ? 'Mark refunded and put the items back on sale' : 'Mark refunded (items stay sold)')}>Refund</button>
                  )}
                </div>
              )}
            </article>
          )
        })}
        {rows.length === 0 && <p className="py-10 text-center text-sm text-brand-gray-500">Nothing here.</p>}
      </div>
    </div>
  )
}

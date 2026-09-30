import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { StatusPill } from '../../components/ui/StatusPill'
import { formatDateTime } from '../../lib/dates'
import { formatGhs } from '../../lib/format'
import { supabase } from '../../lib/supabaseClient'
import type { OrderRow } from '../../types/database'

export function OrdersPage() {
  const [state, setState] = useState<{ orders: OrderRow[]; titles: Map<string, string[]>; error: string | null } | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (cancelled) return
      if (error) return setState({ orders: [], titles: new Map(), error: error.message })
      const ids = (orders ?? []).map((o) => o.id)
      const titles = new Map<string, string[]>()
      if (ids.length > 0) {
        const { data: items } = await supabase.from('order_items').select('order_id, title_snapshot').in('order_id', ids)
        for (const it of items ?? []) titles.set(it.order_id, [...(titles.get(it.order_id) ?? []), it.title_snapshot])
      }
      if (!cancelled) setState({ orders: orders ?? [], titles, error: null })
    })()
    return () => {
      cancelled = true
    }
  }, [tick])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'My orders' }]} />
      <h1 className="mb-4 text-xl font-semibold text-brand-gray-900">My orders</h1>

      {!state && (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-brand-gray-100" />)}
        </div>
      )}
      {state?.error && <ErrorState message={state.error} onRetry={() => setTick((t) => t + 1)} />}
      {state && !state.error && state.orders.length === 0 && (
        <EmptyState
          title="No orders yet"
          description="When you place an order it shows up here, with its payment and pickup status."
          action={<Link to="/" className="mt-2 rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark">Start shopping</Link>}
        />
      )}
      {state && state.orders.length > 0 && (
        <ul className="space-y-3">
          {state.orders.map((o) => {
            const titles = state.titles.get(o.id) ?? []
            return (
              <li key={o.id}>
                <Link to={`/order/${o.id}`} className="block rounded-lg border border-brand-gray-200 p-4 hover:border-brand-gray-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-brand-gray-900">#{o.id.slice(0, 8).toUpperCase()}</span>
                    <StatusPill status={o.status} hasReference={!!o.payment_reference} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-brand-gray-600">{titles.join(', ') || '—'}</p>
                  <p className="mt-1 flex justify-between text-xs text-brand-gray-500">
                    <span>{formatDateTime(o.created_at)}</span>
                    <span className="font-medium text-brand-gray-900">{formatGhs(o.total_ghs)}</span>
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

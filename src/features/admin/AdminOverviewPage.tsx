import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import { PageHeader, QueryError } from './AdminUi'

async function count(q: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const res = await q
  if (res.error) throw new Error(res.error.message)
  return res.count ?? 0
}

export function AdminOverviewPage() {
  const { data, error, reload } = useAdminQuery(async () => {
    const head = { count: 'exact', head: true } as const
    const [review, unpaid, toDeliver, available, openBatches] = await Promise.all([
      count(supabase.from('orders').select('id', head).eq('status', 'awaiting_payment').not('payment_reference', 'is', null)),
      count(supabase.from('orders').select('id', head).eq('status', 'awaiting_payment').is('payment_reference', null)),
      count(supabase.from('orders').select('id', head).eq('status', 'paid')),
      count(supabase.from('items').select('id', head).eq('status', 'available')),
      count(supabase.from('order_batches').select('id', head).eq('status', 'open')),
    ])
    return { review, unpaid, toDeliver, available, openBatches }
  }, 'overview')

  if (error) return <QueryError message={error} onRetry={reload} />

  const cards = [
    { label: 'Payments to confirm', value: data?.review, to: '/admin/orders?tab=review', hot: true },
    { label: 'Paid, waiting for delivery', value: data?.toDeliver, to: '/admin/orders?tab=paid' },
    { label: 'Awaiting payment', value: data?.unpaid, to: '/admin/orders?tab=unpaid' },
    { label: 'Items for sale', value: data?.available, to: '/admin/items' },
    { label: 'Open batches', value: data?.openBatches, to: '/admin/batches' },
  ]

  return (
    <div>
      <PageHeader title="Overview">
        <Link to="/admin/items/new" className="rounded-full bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark">
          + Add item
        </Link>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className={`rounded-lg border p-4 hover:border-brand-gray-400 ${
              c.hot && (c.value ?? 0) > 0 ? 'border-brand-red bg-brand-red-light/40' : 'border-brand-gray-200'
            }`}
          >
            <p className="text-2xl font-bold text-brand-gray-900">{c.value ?? '…'}</p>
            <p className="text-sm text-brand-gray-600">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

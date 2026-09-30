import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { unwrap, useAdminQuery } from '../../../hooks/useAdminQuery'
import { formatDate } from '../../../lib/dates'
import { formatGhs } from '../../../lib/format'
import { Loading, PageHeader, QueryError } from '../AdminUi'
import { secondaryBtn } from '../adminStyles'

/** Printable list of everything to hand over for one batch (paid orders only). */
export function PickupListPage() {
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, reload } = useAdminQuery(async () => {
    const [batch, orders] = await Promise.all([
      supabase.from('order_batches').select('*').eq('id', id!).maybeSingle(),
      supabase.rpc('admin_list_orders', { p_batch_id: id!, p_status: null }),
    ])
    return { batch: unwrap(batch), orders: unwrap(orders).filter((o) => o.status === 'paid' || o.status === 'delivered') }
  }, `pickup:${id}`)

  if (error) return <QueryError message={error} onRetry={reload} />
  if (loading || !data) return <Loading />
  if (!data.batch) return <p className="py-10 text-center text-brand-gray-600">Batch not found.</p>

  const orders = [...data.orders].sort((a, b) => (a.student_name ?? '').localeCompare(b.student_name ?? ''))
  const byVendor = new Map<string, string[]>()
  for (const o of orders) for (const i of o.items) {
    const list = byVendor.get(i.vendor ?? 'No vendor') ?? []
    list.push(i.title)
    byVendor.set(i.vendor ?? 'No vendor', list)
  }
  const totalItems = orders.reduce((n, o) => n + o.items.length, 0)
  const totalCash = orders.reduce((n, o) => n + o.total_ghs, 0)

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Pickup list · ${data.batch.delivery_date ? formatDate(data.batch.delivery_date) : 'no date'}`}>
        <Link to="/admin/batches" className={`${secondaryBtn} print:hidden`}>Back</Link>
        <button type="button" className={`${secondaryBtn} print:hidden`} onClick={() => window.print()}>Print</button>
      </PageHeader>
      <p className="mb-4 text-sm text-brand-gray-600">
        {data.batch.pickup_point ?? 'No pickup point'} · {orders.length} order{orders.length === 1 ? '' : 's'} · {totalItems} item{totalItems === 1 ? '' : 's'} · {formatGhs(totalCash)} collected
      </p>

      {orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-brand-gray-500">No paid orders in this batch yet.</p>
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-brand-gray-900 text-left text-xs uppercase tracking-wide">
                <th className="w-8 py-2">✓</th>
                <th className="py-2">Student</th>
                <th className="py-2">Items</th>
                <th className="py-2 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="break-inside-avoid border-b border-brand-gray-300 align-top">
                  <td className="py-2"><span className="inline-block h-4 w-4 border border-brand-gray-900 align-middle" aria-hidden /></td>
                  <td className="py-2 pr-3">
                    <p className="font-medium">{o.student_name || o.student_email}{o.status === 'delivered' && <span className="ml-2 text-xs font-normal text-brand-gray-500">(delivered)</span>}</p>
                    <p className="text-xs text-brand-gray-600">{o.student_phone}</p>
                  </td>
                  <td className="py-2 pr-3">
                    {o.items.map((i) => <p key={i.item_id}>{i.title}</p>)}
                  </td>
                  <td className="py-2 text-right">{formatGhs(o.total_ghs)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="mb-2 mt-8 text-base font-semibold">By vendor (for sourcing)</h2>
          <ul className="space-y-1 text-sm">
            {[...byVendor.entries()].map(([vendor, titles]) => (
              <li key={vendor}><span className="font-medium">{vendor}</span> — {titles.join(', ')}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

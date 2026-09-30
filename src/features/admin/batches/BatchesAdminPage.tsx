import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { unwrap, useAdminQuery } from '../../../hooks/useAdminQuery'
import { useToast } from '../../../hooks/useToast'
import { formatDateTime } from '../../../lib/dates'
import { fromLocalInput, toLocalInput } from '../../../lib/dateInput'
import type { BatchStatus, OrderBatchRow } from '../../../types/database'
import { Field, Loading, Notice, PageHeader, QueryError } from '../AdminUi'
import { inputCls, linkBtn, primaryBtn, secondaryBtn } from '../adminStyles'

interface BatchForm { closesAt: string; deliveryDate: string; pickupPoint: string }
const BLANK: BatchForm = { closesAt: '', deliveryDate: '', pickupPoint: '' }

export function BatchesAdminPage() {
  const { showToast } = useToast()
  const { data, error, loading, reload } = useAdminQuery(async () => {
    const [batches, orders] = await Promise.all([
      supabase.from('order_batches').select('*').order('closes_at', { ascending: false }),
      supabase.from('orders').select('batch_id, status'),
    ])
    const counts: Record<string, { paid: number; total: number }> = {}
    for (const o of unwrap(orders)) {
      const c = (counts[o.batch_id] ??= { paid: 0, total: 0 })
      if (['awaiting_payment', 'paid', 'delivered'].includes(o.status)) c.total++
      if (o.status === 'paid' || o.status === 'delivered') c.paid++
    }
    return { batches: unwrap(batches), counts }
  }, 'batches')

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<BatchForm>(BLANK)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (error) return <QueryError message={error} onRetry={reload} />
  if (loading || !data) return <Loading />

  function startEdit(b: OrderBatchRow | null) {
    setFormError(null)
    setEditingId(b ? b.id : 'new')
    setForm(b ? { closesAt: toLocalInput(b.closes_at), deliveryDate: b.delivery_date ?? '', pickupPoint: b.pickup_point ?? '' } : BLANK)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const closes = fromLocalInput(form.closesAt)
    if (!closes) return setFormError('Choose when orders close.')
    const values = { closes_at: closes, delivery_date: form.deliveryDate || null, pickup_point: form.pickupPoint.trim() || null }
    setBusy(true)
    const res = editingId === 'new'
      ? await supabase.from('order_batches').insert({ ...values, status: 'open' })
      : await supabase.from('order_batches').update(values).eq('id', editingId!)
    setBusy(false)
    if (res.error) return setFormError(res.error.message)
    setEditingId(null)
    reload()
    showToast(editingId === 'new' ? 'Batch created' : 'Batch updated')
  }

  async function setStatus(b: OrderBatchRow, status: BatchStatus) {
    if (status === 'open' && new Date(b.closes_at) < new Date()) {
      showToast('Its closing time has passed. Edit the batch and pick a new closing time first.')
      return startEdit(b)
    }
    const { error: e } = await supabase.from('order_batches').update({ status }).eq('id', b.id)
    if (e) showToast(e.message)
    reload()
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Batches">
        <button type="button" className={primaryBtn} onClick={() => startEdit(null)}>+ New batch</button>
      </PageHeader>
      <p className="mb-4 text-sm text-brand-gray-500">A batch is one delivery/pickup run. Students pick an open batch at checkout.</p>

      {editingId && (
        <form onSubmit={save} className="mb-5 grid gap-3 rounded-lg border border-brand-gray-200 p-4 sm:grid-cols-3">
          <Field label="Orders close"><input type="datetime-local" className={inputCls} value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></Field>
          <Field label="Pickup date"><input type="date" className={inputCls} value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} /></Field>
          <Field label="Pickup point"><input className={inputCls} value={form.pickupPoint} onChange={(e) => setForm({ ...form, pickupPoint: e.target.value })} placeholder="Ashesi Quad" /></Field>
          {formError && <div className="sm:col-span-3"><Notice>{formError}</Notice></div>}
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={busy} className={primaryBtn}>{editingId === 'new' ? 'Create batch' : 'Save'}</button>
            <button type="button" className={secondaryBtn} onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {data.batches.map((b) => {
          const c = data.counts[b.id] ?? { paid: 0, total: 0 }
          return (
            <li key={b.id} className="rounded-lg border border-brand-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-gray-900">
                    {b.delivery_date ?? 'No pickup date'}{b.pickup_point && <> · {b.pickup_point}</>}
                  </p>
                  <p className="text-xs text-brand-gray-500">Orders close {formatDateTime(b.closes_at)} · {c.total} order{c.total === 1 ? '' : 's'}, {c.paid} paid</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.status === 'open' ? 'bg-brand-red-light text-brand-red-dark' : 'bg-brand-gray-100 text-brand-gray-600'}`}>
                  {b.status === 'open' ? 'Open' : b.status === 'closed' ? 'Closed' : 'Completed'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <Link to={`/admin/batches/${b.id}/pickup`} className={linkBtn}>Pickup list</Link>
                <button type="button" className={linkBtn} onClick={() => startEdit(b)}>Edit</button>
                {b.status === 'open' && <button type="button" className={linkBtn} onClick={() => setStatus(b, 'closed')}>Close orders</button>}
                {b.status === 'closed' && <button type="button" className={linkBtn} onClick={() => setStatus(b, 'open')}>Reopen</button>}
                {b.status !== 'completed' && <button type="button" className={linkBtn} onClick={() => setStatus(b, 'completed')}>Mark completed</button>}
                {b.status === 'completed' && <button type="button" className={linkBtn} onClick={() => setStatus(b, 'closed')}>Undo completed</button>}
              </div>
            </li>
          )
        })}
        {data.batches.length === 0 && <li className="py-10 text-center text-sm text-brand-gray-500">No batches yet. Create one so students can check out.</li>}
      </ul>
    </div>
  )
}

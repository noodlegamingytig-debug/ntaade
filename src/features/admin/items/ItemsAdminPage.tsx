import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { unwrap, useAdminQuery } from '../../../hooks/useAdminQuery'
import { useToast } from '../../../hooks/useToast'
import { resolveImageUrl } from '../../../lib/imageUrl'
import { fromLocalInput } from '../../../lib/dateInput'
import type { ItemRow, ItemStatus } from '../../../types/database'
import { Loading, PageHeader, QueryError } from '../AdminUi'
import { primaryBtn, secondaryBtn, smallInputCls } from '../adminStyles'

const EDITABLE: ItemStatus[] = ['available', 'hidden', 'expired']
const STATUS_LABEL: Record<ItemStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  hidden: 'Hidden',
  expired: 'Unavailable',
}
/** Bulk actions never touch items that are in someone's order. */
const BULK_SAFE: ItemStatus[] = ['available', 'hidden', 'expired']

export function ItemsAdminPage() {
  const { showToast } = useToast()
  const { data, error, loading, reload } = useAdminQuery(async () => {
    const [items, images, cats, vendors] = await Promise.all([
      supabase.from('items').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('item_images').select('item_id, storage_path, position').order('position', { ascending: true }),
      supabase.from('categories').select('id, name').order('sort_order'),
      supabase.from('vendors').select('id, code_name'),
    ])
    const thumb: Record<string, string> = {}
    for (const im of unwrap(images)) if (!(im.item_id in thumb)) thumb[im.item_id] = im.storage_path
    return {
      items: unwrap(items),
      thumb,
      categories: unwrap(cats),
      vendors: Object.fromEntries(unwrap(vendors).map((v) => [v.id, v.code_name])),
    }
  }, 'items')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [percent, setPercent] = useState('')
  const [discountEnds, setDiscountEnds] = useState('')
  const [bulkCat, setBulkCat] = useState('')
  const [bulkOpen, setBulkOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  const filtered = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    return data.items.filter(
      (i) =>
        (!needle || i.title.toLowerCase().includes(needle)) &&
        (!statusFilter || i.status === statusFilter) &&
        (!catFilter || (catFilter === 'none' ? !i.category_id : i.category_id === catFilter)),
    )
  }, [data, q, statusFilter, catFilter])

  if (error) return <QueryError message={error} onRetry={reload} />
  if (loading || !data) return <Loading />

  const { thumb, categories, vendors } = data
  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id))
  const chosen = data.items.filter((i) => selected.has(i.id))
  const skipped = chosen.filter((i) => !BULK_SAFE.includes(i.status)).length

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function patch(id: string, values: Partial<ItemRow>, ok = 'Saved') {
    const { error: e } = await supabase.from('items').update(values).eq('id', id)
    if (e) showToast(e.message)
    else showToast(ok)
    reload()
  }

  async function commitPrice(item: ItemRow, field: 'base' | 'sale') {
    const key = `${item.id}:${field}`
    const raw = drafts[key]
    if (raw === undefined) return
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== key)))
    const current = field === 'base' ? item.base_price_ghs : item.sale_price_ghs
    const value = raw.trim() === '' ? null : Number(raw)
    if (value === current) return
    if (value !== null && (!Number.isFinite(value) || value < 0)) return showToast('Enter a valid price.')
    if (field === 'base') {
      if (value === null) return showToast('An item needs a price.')
      await patch(item.id, { base_price_ghs: value })
    } else {
      await patch(item.id, { sale_price_ghs: value, ...(value === null ? { sale_starts_at: null, sale_ends_at: null } : {}) })
    }
  }

  async function bulkStatus(status: ItemStatus, label: string) {
    const ids = chosen.filter((i) => BULK_SAFE.includes(i.status)).map((i) => i.id)
    if (ids.length === 0) return showToast('Nothing to change: those items are in orders.')
    setBusy(true)
    const { error: e } = await supabase.from('items').update({ status }).in('id', ids).in('status', BULK_SAFE)
    setBusy(false)
    if (e) return showToast(e.message)
    showToast(`${ids.length} item${ids.length === 1 ? '' : 's'} ${label}`)
    setSelected(new Set())
    reload()
  }

  async function bulkCategory() {
    if (!bulkCat) return showToast('Pick a category first.')
    const ids = chosen.map((i) => i.id)
    setBusy(true)
    const { error: e } = await supabase.from('items').update({ category_id: bulkCat === 'none' ? null : bulkCat }).in('id', ids)
    setBusy(false)
    if (e) return showToast(e.message)
    showToast(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'}`)
    setBulkCat('')
    reload()
  }

  async function bulkDiscount() {
    const p = Number(percent)
    if (!Number.isFinite(p) || p < 0 || p >= 100 || percent.trim() === '') return showToast('Enter a percentage from 0 to 99 (0 removes the discount).')
    const ids = chosen.filter((i) => BULK_SAFE.includes(i.status)).map((i) => i.id)
    if (ids.length === 0) return showToast('Nothing to change: those items are in orders.')
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_apply_percent_discount', {
      p_item_ids: ids,
      p_percent: p,
      p_ends_at: fromLocalInput(discountEnds),
    })
    setBusy(false)
    if (e) return showToast(e.message)
    showToast(p === 0 ? 'Discount removed' : `${p}% off applied to ${ids.length} item${ids.length === 1 ? '' : 's'}`)
    setPercent('')
    setDiscountEnds('')
    reload()
  }

  const price = (item: ItemRow, field: 'base' | 'sale') => {
    const v = drafts[`${item.id}:${field}`]
    if (v !== undefined) return v
    const n = field === 'base' ? item.base_price_ghs : item.sale_price_ghs
    return n === null ? '' : String(n)
  }
  const setDraft = (item: ItemRow, field: 'base' | 'sale', v: string) => setDrafts((d) => ({ ...d, [`${item.id}:${field}`]: v }))

  const cols = 'md:grid md:grid-cols-[1.5rem_3rem_minmax(0,1fr)_5.5rem_5.5rem_8rem_9rem] md:items-center md:gap-3'

  return (
    <div>
      <PageHeader title={`Items (${data.items.length})`}>
        <Link to="/admin/items/new" className={primaryBtn}>+ Add item</Link>
      </PageHeader>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-[1fr_10rem_12rem]">
        <input aria-label="Search items" placeholder="Search title…" className={`${smallInputCls} col-span-2 md:col-span-1`} value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by status" className={smallInputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as ItemStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="Filter by category" className={smallInputCls} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          <option value="none">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="sticky top-[6.7rem] z-10 mb-3 space-y-2 rounded-lg border border-brand-red bg-white p-3 shadow-sm md:top-[4rem]">
          <p className="text-sm font-medium text-brand-gray-900">
            {selected.size} selected
            {skipped > 0 && <span className="font-normal text-brand-gray-500"> · {skipped} in an order will be left alone</span>}
            <button type="button" className="ml-3 text-sm font-normal text-brand-gray-500 underline" onClick={() => setSelected(new Set())}>Clear</button>
            <button type="button" aria-expanded={bulkOpen} className="ml-3 text-sm font-semibold text-brand-red" onClick={() => setBulkOpen((o) => !o)}>{bulkOpen ? 'Hide actions' : 'Actions'}</button>
          </p>
          {bulkOpen && <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-brand-gray-600">
              % off
              <input aria-label="Discount percent" inputMode="decimal" className={`${smallInputCls} mt-0.5 block w-20`} value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="20" />
            </label>
            <label className="text-xs text-brand-gray-600">
              Until (optional)
              <input aria-label="Discount ends" type="datetime-local" className={`${smallInputCls} mt-0.5 block`} value={discountEnds} onChange={(e) => setDiscountEnds(e.target.value)} />
            </label>
            <button type="button" disabled={busy} onClick={bulkDiscount} className={secondaryBtn}>Apply discount</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => bulkStatus('expired', 'marked unavailable')} className={secondaryBtn}>Mark unavailable</button>
            <button type="button" disabled={busy} onClick={() => bulkStatus('hidden', 'hidden')} className={secondaryBtn}>Hide</button>
            <button type="button" disabled={busy} onClick={() => bulkStatus('available', 'made available')} className={secondaryBtn}>Make available</button>
            <select aria-label="Bulk category" className={smallInputCls} value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
              <option value="">Change category…</option>
              <option value="none">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" disabled={busy || !bulkCat} onClick={bulkCategory} className={secondaryBtn}>Move</button>
          </div>
          </>}
        </div>
      )}

      <div className={`hidden border-b border-brand-gray-200 pb-2 text-xs font-semibold uppercase tracking-wide text-brand-gray-500 ${cols}`}>
        <input type="checkbox" aria-label="Select all shown" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((i) => i.id)))} className="accent-brand-red" />
        <span />
        <span>Item</span>
        <span>Price</span>
        <span>Sale</span>
        <span>Status</span>
        <span>Category</span>
      </div>

      <ul>
        {filtered.map((item) => {
          const locked = !EDITABLE.includes(item.status)
          return (
            <li key={item.id} className={`grid grid-cols-[auto_3.5rem_1fr] items-start gap-x-3 gap-y-2 border-b border-brand-gray-100 py-3 ${cols}`}>
              <input type="checkbox" aria-label={`Select ${item.title}`} checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="mt-1 accent-brand-red md:mt-0" />
              <div className="h-[4.5rem] w-14 overflow-hidden rounded bg-brand-gray-100 md:h-14 md:w-12">
                {thumb[item.id] && <img src={resolveImageUrl(thumb[item.id])} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <Link to={`/admin/items/${item.id}`} className="line-clamp-2 text-sm font-medium text-brand-gray-900 hover:text-brand-red">{item.title}</Link>
                <p className="text-xs text-brand-gray-500">
                  Size {item.size ?? '—'} · Grade {item.condition_grade}
                  {item.vendor_id && vendors[item.vendor_id] && <> · {vendors[item.vendor_id]}</>}
                </p>
              </div>
              <div className="col-span-3 grid grid-cols-2 gap-2 md:contents">
                <label className="text-xs text-brand-gray-500">
                  <span className="md:hidden">Price (GH₵)</span>
                  <input aria-label={`Price for ${item.title}`} inputMode="decimal" className={`${smallInputCls} w-full`} value={price(item, 'base')}
                    onChange={(e) => setDraft(item, 'base', e.target.value)} onBlur={() => commitPrice(item, 'base')} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                </label>
                <label className="text-xs text-brand-gray-500">
                  <span className="md:hidden">Sale price</span>
                  <input aria-label={`Sale price for ${item.title}`} inputMode="decimal" placeholder="—" className={`${smallInputCls} w-full`} value={price(item, 'sale')}
                    onChange={(e) => setDraft(item, 'sale', e.target.value)} onBlur={() => commitPrice(item, 'sale')} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                </label>
                <label className="text-xs text-brand-gray-500">
                  <span className="md:hidden">Status</span>
                  {locked ? (
                    <span className="block rounded-md bg-brand-gray-100 px-2 py-1 text-sm text-brand-gray-700" title="Managed through the order">{STATUS_LABEL[item.status]}</span>
                  ) : (
                    <select aria-label={`Status for ${item.title}`} className={`${smallInputCls} w-full`} value={item.status} onChange={(e) => patch(item.id, { status: e.target.value as ItemStatus })}>
                      {EDITABLE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  )}
                </label>
                <label className="text-xs text-brand-gray-500">
                  <span className="md:hidden">Category</span>
                  <select aria-label={`Category for ${item.title}`} className={`${smallInputCls} w-full`} value={item.category_id ?? ''} onChange={(e) => patch(item.id, { category_id: e.target.value || null })}>
                    <option value="">None</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
            </li>
          )
        })}
      </ul>
      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-brand-gray-500">
          {data.items.length === 0 ? 'No items yet. Add your first one.' : 'No items match those filters.'}
        </p>
      )}
    </div>
  )
}

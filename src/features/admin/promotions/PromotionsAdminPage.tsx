import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { unwrap, useAdminQuery } from '../../../hooks/useAdminQuery'
import { useToast } from '../../../hooks/useToast'
import { formatDateTime } from '../../../lib/dates'
import { fromLocalInput, toLocalInput } from '../../../lib/dateInput'
import { formatGhs } from '../../../lib/format'
import type { PromotionRow, PromotionScope, PromotionType } from '../../../types/database'
import { Field, Loading, Notice, PageHeader, QueryError } from '../AdminUi'
import { dangerBtn, inputCls, linkBtn, primaryBtn, secondaryBtn, smallInputCls } from '../adminStyles'

interface Form {
  name: string
  type: PromotionType
  value: string
  scope: PromotionScope
  categoryId: string
  itemIds: string[]
  code: string
  startsAt: string
  endsAt: string
}
const BLANK: Form = { name: '', type: 'percent', value: '', scope: 'all', categoryId: '', itemIds: [], code: '', startsAt: '', endsAt: '' }

interface PreviewRow { item_id: string; title: string; base_price_ghs: number; current_price_ghs: number; promo_price_ghs: number; beats_current: boolean }

function promoState(p: PromotionRow): 'paused' | 'ended' | 'scheduled' | 'active' {
  const now = Date.now()
  if (!p.is_active) return 'paused'
  if (p.ends_at && new Date(p.ends_at).getTime() < now) return 'ended'
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return 'scheduled'
  return 'active'
}
const STATE_LABEL = { paused: 'Paused', ended: 'Ended', scheduled: 'Scheduled', active: 'Active' } as const

export function PromotionsAdminPage() {
  const { showToast } = useToast()
  const { data, error, loading, reload } = useAdminQuery(async () => {
    const [promos, cats, items] = await Promise.all([
      supabase.from('promotions').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name').order('sort_order'),
      supabase.from('items').select('id, title, status').order('title').limit(2000),
    ])
    return { promos: unwrap(promos), categories: unwrap(cats), items: unwrap(items) }
  }, 'promotions')

  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<Form>(BLANK)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [itemSearch, setItemSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (error && !data) return <QueryError message={error} onRetry={reload} />
  if (loading || !data) return <Loading />

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm({ ...form, [k]: v })
    setPreview(null)
  }

  function startEdit(p: PromotionRow | null) {
    setFormError(null)
    setPreview(null)
    setItemSearch('')
    setEditing(p ? p.id : 'new')
    setForm(p ? {
      name: p.name, type: p.type, value: String(p.value), scope: p.scope,
      categoryId: p.scope_category_id ?? '', itemIds: p.scope_item_ids ?? [], code: p.code ?? '',
      startsAt: toLocalInput(p.starts_at), endsAt: toLocalInput(p.ends_at),
    } : BLANK)
  }

  function validate(): string | null {
    const v = Number(form.value)
    if (!form.name.trim()) return 'Give the promotion a name.'
    if (form.value.trim() === '' || !Number.isFinite(v) || v <= 0) return 'Enter a discount amount above zero.'
    if (form.type === 'percent' && v >= 100) return 'A percentage discount must be under 100.'
    if (form.scope === 'category' && !form.categoryId) return 'Pick a category.'
    if (form.scope === 'items' && form.itemIds.length === 0) return 'Pick at least one item.'
    const s = fromLocalInput(form.startsAt)
    const e = fromLocalInput(form.endsAt)
    if (s && e && e <= s) return 'The end time must be after the start time.'
    if (form.code.trim() && !/^[A-Za-z0-9_-]{3,20}$/.test(form.code.trim())) return 'Codes are 3–20 letters, numbers, - or _.'
    return null
  }

  async function runPreview() {
    const problem = validate()
    if (problem) return setFormError(problem)
    setFormError(null)
    setBusy(true)
    const { data: rows, error: e } = await supabase.rpc('admin_preview_promotion', {
      p_type: form.type,
      p_value: Number(form.value),
      p_scope: form.scope,
      p_category_id: form.scope === 'category' ? form.categoryId : null,
      p_item_ids: form.scope === 'items' ? form.itemIds : null,
    })
    setBusy(false)
    if (e) return setFormError(e.message)
    setPreview(rows ?? [])
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) return setFormError(problem)
    const values = {
      name: form.name.trim(),
      type: form.type,
      value: Number(form.value),
      scope: form.scope,
      scope_category_id: form.scope === 'category' ? form.categoryId : null,
      scope_item_ids: form.scope === 'items' ? form.itemIds : null,
      code: form.code.trim() ? form.code.trim().toUpperCase() : null,
      starts_at: fromLocalInput(form.startsAt),
      ends_at: fromLocalInput(form.endsAt),
    }
    setBusy(true)
    const res = editing === 'new'
      ? await supabase.from('promotions').insert({ ...values, is_active: true })
      : await supabase.from('promotions').update(values).eq('id', editing!)
    setBusy(false)
    if (res.error) {
      return setFormError(/duplicate|unique/i.test(res.error.message) ? 'That code is already used by another promotion.' : res.error.message)
    }
    setEditing(null)
    setPreview(null)
    reload()
    showToast(editing === 'new' ? 'Promotion created' : 'Promotion saved')
  }

  async function update(id: string, patch: Partial<PromotionRow>, ok: string) {
    const { error: e } = await supabase.from('promotions').update(patch).eq('id', id)
    if (e) showToast(e.message)
    else showToast(ok)
    reload()
  }

  async function remove(id: string) {
    const { error: e } = await supabase.from('promotions').delete().eq('id', id)
    setConfirmDelete(null)
    if (e) showToast(e.message)
    else showToast('Promotion deleted')
    reload()
  }

  const needle = itemSearch.trim().toLowerCase()
  const pickable = data.items.filter((i) => !needle || i.title.toLowerCase().includes(needle)).slice(0, 40)
  const titleOf = (id: string) => data.items.find((i) => i.id === id)?.title ?? 'Unknown item'
  const scopeText = (p: PromotionRow) =>
    p.scope === 'all' ? 'Everything'
      : p.scope === 'category' ? `Category: ${data.categories.find((c) => c.id === p.scope_category_id)?.name ?? '—'}`
        : `${p.scope_item_ids?.length ?? 0} selected item(s)`

  return (
    <div className="max-w-3xl">
      <PageHeader title="Promotions">
        <button type="button" className={primaryBtn} onClick={() => startEdit(null)}>+ New promotion</button>
      </PageHeader>
      <p className="mb-4 text-sm text-brand-gray-500">
        Students always get the single best deal on an item (its own sale price, an automatic promotion, or a code they enter). Deals don’t stack.
      </p>

      {editing && (
        <form onSubmit={save} className="mb-6 space-y-3 rounded-lg border border-brand-gray-200 p-4">
          <h2 className="text-base font-semibold">{editing === 'new' ? 'New promotion' : 'Edit promotion'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Weekend sale" /></Field></div>
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={(e) => set('type', e.target.value as PromotionType)}>
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off (GH₵)</option>
              </select>
            </Field>
            <Field label={form.type === 'percent' ? 'Percent off' : 'Amount off (GH₵)'}>
              <input className={inputCls} inputMode="decimal" value={form.value} onChange={(e) => set('value', e.target.value)} />
            </Field>
            <Field label="Applies to">
              <select className={inputCls} value={form.scope} onChange={(e) => set('scope', e.target.value as PromotionScope)}>
                <option value="all">Everything</option>
                <option value="category">One category</option>
                <option value="items">Specific items</option>
              </select>
            </Field>
            {form.scope === 'category' && (
              <Field label="Category">
                <select className={inputCls} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">Choose…</option>
                  {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Promo code (optional)" hint="Leave empty to apply automatically. With a code, students must enter it in their cart.">
              <input className={`${inputCls} uppercase`} value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="WELCOME10" />
            </Field>
            <span />
            <Field label="Starts (optional)"><input type="datetime-local" className={inputCls} value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></Field>
            <Field label="Ends (optional)"><input type="datetime-local" className={inputCls} value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></Field>
          </div>

          {form.scope === 'items' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-brand-gray-700">Items ({form.itemIds.length} chosen)</p>
              {form.itemIds.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {form.itemIds.map((id) => (
                    <li key={id} className="flex items-center gap-1 rounded-full bg-brand-gray-100 py-0.5 pl-2.5 pr-1 text-xs">
                      {titleOf(id)}
                      <button type="button" aria-label={`Remove ${titleOf(id)}`} className="px-1 text-brand-gray-500 hover:text-brand-red" onClick={() => set('itemIds', form.itemIds.filter((x) => x !== id))}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
              <input aria-label="Search items to add" className={`${smallInputCls} w-full`} placeholder="Search items to add…" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
              <ul className="max-h-48 divide-y divide-brand-gray-100 overflow-y-auto rounded-lg border border-brand-gray-200">
                {pickable.map((i) => (
                  <li key={i.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-brand-gray-50">
                      <input type="checkbox" className="accent-brand-red" checked={form.itemIds.includes(i.id)}
                        onChange={() => set('itemIds', form.itemIds.includes(i.id) ? form.itemIds.filter((x) => x !== i.id) : [...form.itemIds, i.id])} />
                      <span className="min-w-0 flex-1 truncate">{i.title}</span>
                      {i.status !== 'available' && <span className="text-xs text-brand-gray-400">{i.status}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {formError && <Notice>{formError}</Notice>}

          {preview && (
            <div role="region" aria-label="Promotion preview" className="rounded-lg border border-brand-gray-200">
              <p className="border-b border-brand-gray-200 bg-brand-gray-50 px-3 py-2 text-sm font-medium">
                Would apply to {preview.length} available item{preview.length === 1 ? '' : 's'}
                {' · '}
                {preview.filter((r) => r.beats_current).length} get a better price than today
              </p>
              <ul className="max-h-56 divide-y divide-brand-gray-100 overflow-y-auto text-sm">
                {preview.map((r) => (
                  <li key={r.item_id} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                    <span className="min-w-0 truncate">{r.title}</span>
                    <span className="shrink-0 text-right">
                      {r.beats_current ? (
                        <><span className="text-brand-gray-400 line-through">{formatGhs(r.current_price_ghs)}</span> <span className="font-semibold text-brand-red-dark">{formatGhs(r.promo_price_ghs)}</span></>
                      ) : (
                        <span className="text-xs text-brand-gray-500">no change ({formatGhs(r.current_price_ghs)} is already lower)</span>
                      )}
                    </span>
                  </li>
                ))}
                {preview.length === 0 && <li className="px-3 py-3 text-center text-brand-gray-500">No available items match.</li>}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryBtn} disabled={busy} onClick={runPreview}>Preview affected items</button>
            <button type="submit" className={primaryBtn} disabled={busy}>{editing === 'new' ? 'Create promotion' : 'Save changes'}</button>
            <button type="button" className={secondaryBtn} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {data.promos.map((p) => {
          const state = promoState(p)
          return (
            <li key={p.id} className="rounded-lg border border-brand-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-gray-900">{p.name}</p>
                  <p className="text-sm text-brand-gray-600">
                    {p.type === 'percent' ? `${p.value}% off` : `${formatGhs(p.value)} off`} · {scopeText(p)}
                    {p.code && <> · code <span className="font-mono font-semibold">{p.code}</span></>}
                  </p>
                  <p className="text-xs text-brand-gray-500">
                    {p.starts_at ? `From ${formatDateTime(p.starts_at)}` : 'Starts immediately'}
                    {' · '}
                    {p.ends_at ? `until ${formatDateTime(p.ends_at)}` : 'no end date'}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${state === 'active' ? 'bg-brand-red-light text-brand-red-dark' : 'bg-brand-gray-100 text-brand-gray-600'}`}>
                  {STATE_LABEL[state]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <button type="button" className={linkBtn} onClick={() => startEdit(p)}>Edit</button>
                {p.is_active
                  ? <button type="button" className={linkBtn} onClick={() => update(p.id, { is_active: false }, 'Paused')}>Pause</button>
                  : <button type="button" className={linkBtn} onClick={() => update(p.id, { is_active: true }, 'Resumed')}>Resume</button>}
                {state !== 'ended' && <button type="button" className={linkBtn} onClick={() => update(p.id, { ends_at: new Date().toISOString() }, 'Ended')}>End now</button>}
                {confirmDelete === p.id ? (
                  <span className="flex items-center gap-2 text-sm">
                    Delete?
                    <button type="button" className={dangerBtn} onClick={() => remove(p.id)}>Yes</button>
                    <button type="button" className={secondaryBtn} onClick={() => setConfirmDelete(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className={linkBtn} onClick={() => setConfirmDelete(p.id)}>Delete</button>
                )}
              </div>
            </li>
          )
        })}
        {data.promos.length === 0 && <li className="py-10 text-center text-sm text-brand-gray-500">No promotions yet.</li>}
      </ul>
    </div>
  )
}

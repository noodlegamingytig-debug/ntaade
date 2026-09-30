import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { unwrap, useAdminQuery } from '../../../hooks/useAdminQuery'
import { useToast } from '../../../hooks/useToast'
import { fromLocalInput, toLocalInput } from '../../../lib/dateInput'
import { removeStoredFiles, uploadItemImages, type StagedImage } from '../../../lib/itemImages'
import type { ConditionGrade, Department, ItemRow, ItemStatus } from '../../../types/database'
import { Field, Loading, Notice, PageHeader, QueryError } from '../AdminUi'
import { dangerBtn, inputCls, primaryBtn, secondaryBtn, smallInputCls } from '../adminStyles'
import { ImageManager } from './ImageManager'

interface MeasureRow { label: string; value: string }
interface Form {
  title: string
  description: string
  categoryId: string
  department: Department
  size: string
  grade: ConditionGrade
  basePrice: string
  salePrice: string
  saleStarts: string
  saleEnds: string
  status: ItemStatus
  vendorCode: string
  measures: MeasureRow[]
}

const EMPTY: Form = {
  title: '', description: '', categoryId: '', department: 'unisex', size: '', grade: 'B',
  basePrice: '', salePrice: '', saleStarts: '', saleEnds: '', status: 'available', vendorCode: '',
  measures: [{ label: 'Chest', value: '' }, { label: 'Length', value: '' }],
}

const keyToLabel = (key: string) => {
  const s = key.replace(/_in$/, '').replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function measuresToJson(rows: MeasureRow[]): Record<string, number | string> {
  const out: Record<string, number | string> = {}
  for (const r of rows) {
    const label = r.label.trim()
    const value = r.value.trim()
    if (!label || !value) continue
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    if (!key) continue
    const n = Number(value)
    if (Number.isFinite(n)) out[`${key}_in`] = n
    else out[key] = value
  }
  return out
}

function formFromItem(item: ItemRow, vendorCode: string): Form {
  const rows = Object.entries(item.measurements ?? {}).map(([k, v]) => ({ label: keyToLabel(k), value: String(v) }))
  return {
    title: item.title,
    description: item.description ?? '',
    categoryId: item.category_id ?? '',
    department: item.department,
    size: item.size ?? '',
    grade: item.condition_grade,
    basePrice: String(item.base_price_ghs),
    salePrice: item.sale_price_ghs === null ? '' : String(item.sale_price_ghs),
    saleStarts: toLocalInput(item.sale_starts_at),
    saleEnds: toLocalInput(item.sale_ends_at),
    status: item.status,
    vendorCode,
    measures: rows.length ? rows : EMPTY.measures,
  }
}

export function ItemEditPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { data, error, loading, reload } = useAdminQuery(async () => {
    const [cats, vendors] = await Promise.all([
      supabase.from('categories').select('id, name').order('sort_order'),
      supabase.from('vendors').select('id, code_name').order('code_name'),
    ])
    const base = { categories: unwrap(cats), vendors: unwrap(vendors) }
    if (!id) return { ...base, item: null, images: [] as { id: string; storage_path: string; position: number }[] }
    const [item, images] = await Promise.all([
      supabase.from('items').select('*').eq('id', id).maybeSingle(),
      supabase.from('item_images').select('id, storage_path, position').eq('item_id', id).order('position', { ascending: true }),
    ])
    return { ...base, item: unwrap(item), images: unwrap(images) }
  }, `item:${id ?? 'new'}`)

  const [draft, setDraft] = useState<Form | null>(null)
  const [staged, setStaged] = useState<StagedImage[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (error) return <QueryError message={error} onRetry={reload} />
  if (loading || !data) return <Loading />
  if (!isNew && !data.item) {
    return (
      <div className="py-10 text-center">
        <p className="text-brand-gray-700">That item doesn't exist.</p>
        <Link to="/admin/items" className="mt-3 inline-block text-sm font-medium text-brand-red">Back to items</Link>
      </div>
    )
  }

  const vendorCodeOf = (vendorId: string | null) => data.vendors.find((v) => v.id === vendorId)?.code_name ?? ''
  const form: Form = draft ?? (data.item ? formFromItem(data.item, vendorCodeOf(data.item.vendor_id)) : EMPTY)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setDraft({ ...form, [k]: v })
  const locked = !!data.item && (data.item.status === 'reserved' || data.item.status === 'sold')

  function setMeasure(i: number, patch: Partial<MeasureRow>) {
    set('measures', form.measures.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))
  }

  async function resolveVendor(code: string): Promise<string | null> {
    const trimmed = code.trim()
    if (!trimmed) return null
    const existing = data!.vendors.find((v) => v.code_name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing.id
    const created = unwrap(await supabase.from('vendors').insert({ code_name: trimmed }).select('id').single())
    return (created as unknown as { id: string }).id
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const base = Number(form.basePrice)
    const sale = form.salePrice.trim() === '' ? null : Number(form.salePrice)
    if (!form.title.trim()) return setFormError('Give the item a title.')
    if (form.basePrice.trim() === '' || !Number.isFinite(base) || base < 0) return setFormError('Enter a valid price.')
    if (sale !== null && (!Number.isFinite(sale) || sale < 0)) return setFormError('Sale price must be a number.')
    if (sale !== null && sale >= base) return setFormError('The sale price should be lower than the normal price.')

    setSaving(true)
    try {
      const vendorId = await resolveVendor(form.vendorCode)
      const values = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category_id: form.categoryId || null,
        department: form.department,
        size: form.size.trim() || null,
        measurements: measuresToJson(form.measures),
        condition_grade: form.grade,
        base_price_ghs: base,
        sale_price_ghs: sale,
        sale_starts_at: sale === null ? null : fromLocalInput(form.saleStarts),
        sale_ends_at: sale === null ? null : fromLocalInput(form.saleEnds),
        vendor_id: vendorId,
        ...(locked ? {} : { status: form.status }),
      }
      if (isNew) {
        const created = unwrap(await supabase.from('items').insert(values).select('id').single()) as unknown as { id: string }
        try {
          await uploadItemImages(created.id, staged, 0)
        } catch (err) {
          showToast('Item saved, but photos failed to upload. Add them here.')
          navigate(`/admin/items/${created.id}`, { replace: true })
          throw err
        }
        showToast('Item added')
        navigate('/admin/items')
      } else {
        unwrap(await supabase.from('items').update(values).eq('id', id!).select('id'))
        setDraft(null)
        reload()
        showToast('Item saved')
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    const paths = data!.images.map((i) => i.storage_path)
    const { error: e } = await supabase.from('items').delete().eq('id', id!)
    if (e) {
      setSaving(false)
      setConfirmDelete(false)
      return setFormError(/foreign key|violates/i.test(e.message)
        ? 'This item is part of an order, so it can’t be deleted. Set its status to Hidden instead.'
        : e.message)
    }
    await removeStoredFiles(paths)
    showToast('Item deleted')
    navigate('/admin/items', { replace: true })
  }

  return (
    <form onSubmit={save} className="max-w-3xl space-y-8">
      <PageHeader title={isNew ? 'Add item' : 'Edit item'}>
        <Link to="/admin/items" className={secondaryBtn}>Back to items</Link>
      </PageHeader>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Photos</h2>
        <ImageManager
          itemId={isNew ? null : id!}
          saved={data.images}
          onSavedChanged={reload}
          staged={staged}
          onStagedChange={setStaged}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Details</h2>
        <div className="sm:col-span-2">
          <Field label="Title"><input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Vintage Denim Jacket" /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description"><textarea rows={3} className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
        <Field label="Category">
          <select className={inputCls} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">None</option>
            {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Department">
          <select className={inputCls} value={form.department} onChange={(e) => set('department', e.target.value as Department)}>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
          </select>
        </Field>
        <Field label="Size"><input className={inputCls} value={form.size} onChange={(e) => set('size', e.target.value)} placeholder="M, 32, One size…" /></Field>
        <Field label="Condition" hint="A = like new · B = good · C = worn, priced accordingly">
          <select className={inputCls} value={form.grade} onChange={(e) => set('grade', e.target.value as ConditionGrade)}>
            <option value="A">A — Like new</option>
            <option value="B">B — Good</option>
            <option value="C">C — Worn</option>
          </select>
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Measurements (inches)</h2>
        {form.measures.map((m, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label={`Measurement ${i + 1} name`} className={`${smallInputCls} flex-1`} value={m.label} onChange={(e) => setMeasure(i, { label: e.target.value })} placeholder="Chest" />
            <input aria-label={`Measurement ${i + 1} value`} className={`${smallInputCls} w-24`} inputMode="decimal" value={m.value} onChange={(e) => setMeasure(i, { value: e.target.value })} placeholder="40" />
            <button type="button" aria-label={`Remove measurement ${i + 1}`} className="px-2 text-brand-gray-500 hover:text-brand-red" onClick={() => set('measures', form.measures.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="text-sm font-medium text-brand-red" onClick={() => set('measures', [...form.measures, { label: '', value: '' }])}>+ Add measurement</button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Price</h2>
        <Field label="Price (GH₵)"><input className={inputCls} inputMode="decimal" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} /></Field>
        <Field label="Sale price (GH₵)" hint="Optional. Leave empty for no sale."><input className={inputCls} inputMode="decimal" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} /></Field>
        {form.salePrice.trim() !== '' && (
          <>
            <Field label="Sale starts (optional)"><input type="datetime-local" className={inputCls} value={form.saleStarts} onChange={(e) => set('saleStarts', e.target.value)} /></Field>
            <Field label="Sale ends (optional)"><input type="datetime-local" className={inputCls} value={form.saleEnds} onChange={(e) => set('saleEnds', e.target.value)} /></Field>
          </>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Internal</h2>
        <Field label="Vendor code" hint="Never shown to students. Type a new code to create a vendor.">
          <input className={inputCls} list="vendor-codes" value={form.vendorCode} onChange={(e) => set('vendorCode', e.target.value)} placeholder="V-MAKOLA-01" />
          <datalist id="vendor-codes">{data.vendors.map((v) => <option key={v.id} value={v.code_name} />)}</datalist>
        </Field>
        <Field label="Status" hint={locked ? 'This item is in an order; its status follows the order.' : undefined}>
          {locked ? (
            <input className={inputCls} disabled value={data.item!.status} />
          ) : (
            <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value as ItemStatus)}>
              <option value="available">Available</option>
              <option value="hidden">Hidden</option>
              <option value="expired">Unavailable</option>
            </select>
          )}
        </Field>
      </section>

      {formError && <Notice>{formError}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Saving…' : isNew ? 'Add item' : 'Save changes'}</button>
        {!isNew && !confirmDelete && (
          <button type="button" className={`${dangerBtn} ml-auto`} onClick={() => setConfirmDelete(true)}>Delete item</button>
        )}
        {!isNew && confirmDelete && (
          <span className="ml-auto flex items-center gap-2 text-sm">
            Delete for good?
            <button type="button" className={dangerBtn} disabled={saving} onClick={remove}>Yes, delete</button>
            <button type="button" className={secondaryBtn} onClick={() => setConfirmDelete(false)}>No</button>
          </span>
        )}
      </div>
    </form>
  )
}

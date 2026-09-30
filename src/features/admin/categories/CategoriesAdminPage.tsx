import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { unwrap, useAdminQuery } from '../../../hooks/useAdminQuery'
import { useToast } from '../../../hooks/useToast'
import { slugify } from '../../../lib/slug'
import type { CategoryRow } from '../../../types/database'
import { Loading, Notice, PageHeader, QueryError } from '../AdminUi'
import { dangerBtn, inputCls, linkBtn, primaryBtn, secondaryBtn, smallInputCls } from '../adminStyles'

export function CategoriesAdminPage() {
  const { showToast } = useToast()
  const { data, error, loading, reload } = useAdminQuery(async () => {
    const [cats, items] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('items').select('category_id'),
    ])
    const counts: Record<string, number> = {}
    for (const r of unwrap(items)) if (r.category_id) counts[r.category_id] = (counts[r.category_id] ?? 0) + 1
    return { categories: unwrap(cats), counts }
  }, 'categories')

  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<{ cat: CategoryRow; target: string; error: string | null } | null>(null)

  if (error) return <QueryError message={error} onRetry={reload} />
  if (loading || !data) return <Loading />
  const { categories, counts } = data

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) {
    setBusy(true)
    const { error: e } = await fn()
    setBusy(false)
    if (e) {
      showToast(e.message)
      return false
    }
    reload()
    if (ok) showToast(ok)
    return true
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const name = newName.trim()
    const slug = slugify(name)
    if (!name || !slug) return setFormError('Give the category a name.')
    if (categories.some((c) => c.slug === slug)) return setFormError('A category with that name already exists.')
    const next = Math.max(0, ...categories.map((c) => c.sort_order)) + 1
    const ok = await run(
      () => supabase.from('categories').insert({ name, slug, parent_id: newParent || null, sort_order: next, is_active: true }),
      'Category added',
    )
    if (ok) {
      setNewName('')
      setNewParent('')
    }
  }

  async function move(cat: CategoryRow, dir: -1 | 1) {
    // Renumber the whole list so the swap is unambiguous even if sort_orders collide.
    const ordered = [...categories]
    const i = ordered.findIndex((c) => c.id === cat.id)
    const j = i + dir
    if (j < 0 || j >= ordered.length) return
    ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
    setBusy(true)
    const results = await Promise.all(
      ordered.map((c, idx) => (c.sort_order === idx + 1 ? null : supabase.from('categories').update({ sort_order: idx + 1 }).eq('id', c.id))),
    )
    setBusy(false)
    const failed = results.find((r) => r && r.error)
    if (failed?.error) showToast(failed.error.message)
    reload()
  }

  async function saveRename() {
    if (!renaming) return
    const name = renaming.name.trim()
    if (!name) return
    const ok = await run(() => supabase.from('categories').update({ name }).eq('id', renaming.id), 'Renamed')
    if (ok) setRenaming(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    const { cat, target } = deleting
    const inUse = (counts[cat.id] ?? 0) > 0 || categories.some((c) => c.parent_id === cat.id)
    if (inUse && !target) return setDeleting({ ...deleting, error: 'Pick a category to move its items into.' })
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_delete_category', {
      p_category_id: cat.id,
      p_reassign_to: target || null,
    })
    setBusy(false)
    if (e) return setDeleting({ ...deleting, error: e.message })
    setDeleting(null)
    reload()
    showToast('Category deleted')
  }

  const nameOf = (id: string | null) => categories.find((c) => c.id === id)?.name

  return (
    <div className="max-w-3xl">
      <PageHeader title="Categories" />

      <form onSubmit={add} className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-brand-gray-200 p-3">
        <label className="min-w-40 flex-1 text-sm text-brand-gray-700">
          <span className="font-medium">New category</span>
          <input className={`${inputCls} mt-1`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Jeans" />
        </label>
        <label className="text-sm text-brand-gray-700">
          <span className="font-medium">Inside (optional)</span>
          <select className={`${inputCls} mt-1`} value={newParent} onChange={(e) => setNewParent(e.target.value)}>
            <option value="">Top level</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy} className={primaryBtn}>Add</button>
        {formError && <div className="w-full"><Notice>{formError}</Notice></div>}
      </form>

      <ul className="divide-y divide-brand-gray-100 rounded-lg border border-brand-gray-200">
        {categories.map((c, idx) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <div className="flex flex-col">
              <button type="button" aria-label={`Move ${c.name} up`} disabled={busy || idx === 0} onClick={() => move(c, -1)} className="px-1 text-xs leading-none text-brand-gray-500 hover:text-brand-gray-900 disabled:opacity-30">▲</button>
              <button type="button" aria-label={`Move ${c.name} down`} disabled={busy || idx === categories.length - 1} onClick={() => move(c, 1)} className="px-1 text-xs leading-none text-brand-gray-500 hover:text-brand-gray-900 disabled:opacity-30">▼</button>
            </div>
            <div className="min-w-0 flex-1">
              {renaming?.id === c.id ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    aria-label="Category name"
                    className={`${smallInputCls} flex-1`}
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveRename(); if (e.key === 'Escape') setRenaming(null) }}
                  />
                  <button type="button" className={linkBtn} onClick={saveRename}>Save</button>
                  <button type="button" className="text-sm text-brand-gray-500" onClick={() => setRenaming(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <p className={`text-sm font-medium ${c.is_active ? 'text-brand-gray-900' : 'text-brand-gray-400'}`}>
                    {c.name}
                    {!c.is_active && <span className="ml-2 rounded-full bg-brand-gray-100 px-2 py-0.5 text-xs font-normal text-brand-gray-500">Hidden</span>}
                  </p>
                  <p className="text-xs text-brand-gray-500">
                    {counts[c.id] ?? 0} item{(counts[c.id] ?? 0) === 1 ? '' : 's'}
                    {c.parent_id && <> · inside {nameOf(c.parent_id)}</>}
                  </p>
                </>
              )}
            </div>
            {renaming?.id !== c.id && (
              <div className="flex items-center gap-3">
                <button type="button" className={linkBtn} disabled={busy} onClick={() => setRenaming({ id: c.id, name: c.name })}>Rename</button>
                <button type="button" className={linkBtn} disabled={busy} onClick={() => run(() => supabase.from('categories').update({ is_active: !c.is_active }).eq('id', c.id), c.is_active ? 'Hidden from shop' : 'Visible in shop')}>
                  {c.is_active ? 'Hide' : 'Show'}
                </button>
                <button type="button" className={linkBtn} disabled={busy} onClick={() => setDeleting({ cat: c, target: '', error: null })}>Delete</button>
              </div>
            )}
          </li>
        ))}
        {categories.length === 0 && <li className="px-3 py-6 text-center text-sm text-brand-gray-500">No categories yet.</li>}
      </ul>

      {deleting && (
        <div role="dialog" aria-label={`Delete ${deleting.cat.name}`} className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-brand-gray-900">Delete “{deleting.cat.name}”?</h2>
            {(counts[deleting.cat.id] ?? 0) > 0 || categories.some((c) => c.parent_id === deleting.cat.id) ? (
              <>
                <p className="text-sm text-brand-gray-600">
                  It still holds {counts[deleting.cat.id] ?? 0} item(s). Choose where they should go. (Or cancel and use Hide instead.)
                </p>
                <select aria-label="Move items to" className={inputCls} value={deleting.target} onChange={(e) => setDeleting({ ...deleting, target: e.target.value, error: null })}>
                  <option value="">Move items to…</option>
                  {categories.filter((c) => c.id !== deleting.cat.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </>
            ) : (
              <p className="text-sm text-brand-gray-600">This category is empty, so nothing else changes.</p>
            )}
            {deleting.error && <Notice>{deleting.error}</Notice>}
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryBtn} onClick={() => setDeleting(null)}>Cancel</button>
              <button type="button" className={dangerBtn} disabled={busy} onClick={confirmDelete}>Delete category</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

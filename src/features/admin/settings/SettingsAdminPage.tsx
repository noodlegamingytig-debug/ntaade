import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { unwrap, useAdminQuery } from '../../../hooks/useAdminQuery'
import { useToast } from '../../../hooks/useToast'
import { Field, Loading, Notice, PageHeader, QueryError } from '../AdminUi'
import { inputCls, primaryBtn } from '../adminStyles'

const KEYS = ['delivery_fee_ghs', 'payment_network', 'payment_number', 'payment_account_name'] as const
type Drafts = Partial<Record<(typeof KEYS)[number], string>>

export function SettingsAdminPage() {
  const { showToast } = useToast()
  const { data, error, loading, reload } = useAdminQuery(async () => {
    const rows = unwrap(await supabase.from('settings').select('key, value'))
    return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>
  }, 'settings')
  const [drafts, setDrafts] = useState<Drafts>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (error) return <QueryError message={error} onRetry={reload} />
  if (loading || !data) return <Loading />

  const val = (k: (typeof KEYS)[number]) => drafts[k] ?? String(data[k] ?? '')
  const set = (k: (typeof KEYS)[number], v: string) => setDrafts((d) => ({ ...d, [k]: v }))
  const dirty = Object.keys(drafts).length > 0

  async function save(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const fee = Number(val('delivery_fee_ghs'))
    if (!Number.isFinite(fee) || fee < 0) return setFormError('Delivery fee must be zero or more.')
    if (!val('payment_number').trim()) return setFormError('Enter the number students should send payment to.')

    setSaving(true)
    const rows = [
      { key: 'delivery_fee_ghs', value: fee },
      { key: 'payment_network', value: val('payment_network').trim() },
      { key: 'payment_number', value: val('payment_number').trim() },
      { key: 'payment_account_name', value: val('payment_account_name').trim() },
    ].map((r) => ({ ...r, updated_at: new Date().toISOString() }))
    const { error: saveError } = await supabase.from('settings').upsert(rows, { onConflict: 'key' })
    setSaving(false)
    if (saveError) return setFormError(saveError.message)
    setDrafts({})
    reload()
    showToast('Settings saved')
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" />
      <form onSubmit={save} className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-brand-gray-900">Delivery</h2>
          <Field label="Delivery fee (GH₵)" hint="Added to every order. Use 0 for free delivery.">
            <input className={inputCls} inputMode="decimal" value={val('delivery_fee_ghs')} onChange={(e) => set('delivery_fee_ghs', e.target.value)} />
          </Field>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-brand-gray-900">Payment instructions</h2>
          <p className="text-sm text-brand-gray-500">Shown to students at checkout and on their order page.</p>
          <Field label="Network">
            <input className={inputCls} value={val('payment_network')} onChange={(e) => set('payment_network', e.target.value)} placeholder="MTN MoMo" />
          </Field>
          <Field label="Number">
            <input className={inputCls} inputMode="tel" value={val('payment_number')} onChange={(e) => set('payment_number', e.target.value)} placeholder="024 000 0000" />
          </Field>
          <Field label="Account name">
            <input className={inputCls} value={val('payment_account_name')} onChange={(e) => set('payment_account_name', e.target.value)} />
          </Field>
        </section>

        {formError && <Notice>{formError}</Notice>}
        <button type="submit" disabled={saving || !dirty} className={primaryBtn}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}

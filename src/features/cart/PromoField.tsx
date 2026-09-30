import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useCart } from '../../hooks/useCart'

export function PromoField() {
  const { promoCode, setPromoCode } = useCart()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function apply(e: FormEvent) {
    e.preventDefault()
    const code = draft.trim().toUpperCase()
    if (!code) return
    setBusy(true)
    setMessage(null)
    const { data, error } = await supabase.rpc('check_promo_code', { p_code: code })
    setBusy(false)
    if (error) return setMessage({ ok: false, text: error.message })
    if (!data || data.length === 0) return setMessage({ ok: false, text: "That code isn't valid right now." })
    setPromoCode(code)
    setDraft('')
    setMessage({ ok: true, text: `${data[0].promo_name} applied.` })
  }

  if (promoCode) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-brand-gray-50 px-3 py-2 text-sm">
        <span>
          Code <strong>{promoCode}</strong> applied
        </span>
        <button type="button" onClick={() => { setPromoCode(null); setMessage(null) }} className="text-brand-red hover:underline">
          Remove
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={apply}>
      <div className="flex gap-2">
        <input
          aria-label="Promo code"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Promo code"
          className="min-w-0 flex-1 rounded-lg border border-brand-gray-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-lg border border-brand-gray-300 px-4 text-sm font-medium text-brand-gray-700 hover:border-brand-red hover:text-brand-red disabled:opacity-50"
        >
          Apply
        </button>
      </div>
      {message && (
        <p role="status" className={`mt-1 text-xs ${message.ok ? 'text-brand-gray-600' : 'text-brand-red-dark'}`}>
          {message.text}
        </p>
      )}
    </form>
  )
}

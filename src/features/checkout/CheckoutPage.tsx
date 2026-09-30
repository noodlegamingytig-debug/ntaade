import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatGhs } from '../../lib/format'
import { resolveImageUrl } from '../../lib/imageUrl'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { useCartLines } from '../../hooks/useCartLines'
import { useSettings } from '../../hooks/useSettings'
import type { OrderBatchRow } from '../../types/database'
import { PaymentInstructions } from './PaymentInstructions'

export function CheckoutPage() {
  const navigate = useNavigate()
  const { profile, updateProfile } = useAuth()
  const cart = useCart()
  const { lines, unavailable, subtotal, discount, loading, refresh } = useCartLines(cart.itemIds, cart.promoCode)
  const settings = useSettings()

  const [batches, setBatches] = useState<OrderBatchRow[] | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('order_batches')
      .select('*')
      .eq('status', 'open')
      .gt('closes_at', new Date().toISOString())
      .order('closes_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setBatches(data ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fullName = nameDraft ?? profile?.full_name ?? ''
  const phone = phoneDraft ?? profile?.phone ?? ''
  const selectedBatch = batchId ?? batches?.[0]?.id ?? null
  const deliveryFee = settings.number('delivery_fee_ghs')
  const total = subtotal - discount + (lines.length ? deliveryFee : 0)

  if (cart.itemIds.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          title="Nothing to check out"
          description="Add a piece or two to your cart first."
          action={<Link to="/" className="mt-2 rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark">Back to shop</Link>}
        />
      </div>
    )
  }

  async function placeOrder(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (fullName.trim().length < 2) return setError('Enter your full name so we can find your order at pickup.')
    if (phone.replace(/\D/g, '').length < 9) return setError('Enter a phone number we can reach you on.')
    if (!selectedBatch) return setError('Pick a pickup batch.')

    setSubmitting(true)
    const profileErr = await updateProfile({ full_name: fullName.trim(), phone: phone.trim() })
    if (profileErr) {
      setSubmitting(false)
      return setError(profileErr)
    }
    const { data, error: rpcError } = await supabase.rpc('checkout', {
      p_batch_id: selectedBatch,
      p_item_ids: cart.itemIds,
      p_promo_code: cart.promoCode,
    })
    if (rpcError) {
      setSubmitting(false)
      setError(rpcError.message)
      refresh() // pick up what became unavailable
      return
    }
    const orderId = data?.[0]?.order_id
    await cart.reload()
    cart.setPromoCode(null)
    navigate(orderId ? `/order/${orderId}` : '/orders', { replace: true })
  }

  const blocked = unavailable.length > 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="mb-4 text-xl font-semibold text-brand-gray-900">Checkout</h1>

      <form onSubmit={placeOrder} className="grid gap-8 md:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <section aria-labelledby="who">
            <h2 id="who" className="mb-3 text-base font-semibold text-brand-gray-900">Your details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-brand-gray-700">
                Full name
                <input
                  value={fullName}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoComplete="name"
                  className="mt-1 w-full rounded-lg border border-brand-gray-300 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </label>
              <label className="block text-sm text-brand-gray-700">
                Phone (WhatsApp / MoMo)
                <input
                  value={phone}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  className="mt-1 w-full rounded-lg border border-brand-gray-300 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </label>
            </div>
          </section>

          <section aria-labelledby="pickup">
            <h2 id="pickup" className="mb-3 text-base font-semibold text-brand-gray-900">Pickup batch</h2>
            {batches === null ? (
              <div className="h-16 animate-pulse rounded-lg bg-brand-gray-100" />
            ) : batches.length === 0 ? (
              <p className="rounded-lg bg-brand-gray-50 p-4 text-sm text-brand-gray-600">
                No pickup batch is open right now. Check back soon — your cart will be waiting.
              </p>
            ) : (
              <div className="space-y-2">
                {batches.map((b) => (
                  <label
                    key={b.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                      selectedBatch === b.id ? 'border-brand-red bg-brand-red-light/40' : 'border-brand-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="batch"
                      checked={selectedBatch === b.id}
                      onChange={() => setBatchId(b.id)}
                      className="mt-0.5 accent-brand-red"
                    />
                    <span>
                      <span className="block font-medium text-brand-gray-900">
                        {b.delivery_date ? `Pickup ${formatDate(b.delivery_date)}` : 'Pickup date to be confirmed'}
                        {b.pickup_point && <> · {b.pickup_point}</>}
                      </span>
                      <span className="block text-xs text-brand-gray-500">Orders close {formatDateTime(b.closes_at)}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <PaymentInstructions amount={total} />
        </div>

        <aside className="h-fit space-y-4 rounded-lg border border-brand-gray-200 p-4">
          <h2 className="text-base font-semibold text-brand-gray-900">Order summary</h2>
          <ul className="space-y-3">
            {loading && lines.length === 0 ? (
              <li className="h-12 animate-pulse rounded bg-brand-gray-100" />
            ) : (
              lines.map((l) => (
                <li key={l.itemId} className="flex gap-3 text-sm">
                  <div className="h-14 w-12 shrink-0 overflow-hidden rounded bg-brand-gray-100">
                    {l.imagePath && <img src={resolveImageUrl(l.imagePath)} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1">{l.title}</p>
                    {l.isAvailable ? (
                      <p className="text-brand-gray-600">{formatGhs(l.unitPriceGhs)}</p>
                    ) : (
                      <p className="text-xs font-semibold text-brand-red-dark">No longer available</p>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
          <dl className="space-y-1.5 border-t border-brand-gray-100 pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-brand-gray-600">Subtotal</dt><dd>{formatGhs(subtotal)}</dd></div>
            {discount > 0.001 && (
              <div className="flex justify-between text-brand-red-dark"><dt>Discounts</dt><dd>−{formatGhs(discount)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-brand-gray-600">Delivery</dt><dd>{!settings.loaded ? '…' : deliveryFee > 0 ? formatGhs(deliveryFee) : 'Free'}</dd></div>
            <div className="flex justify-between border-t border-brand-gray-200 pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatGhs(total)}</dd></div>
          </dl>

          {blocked && (
            <p role="alert" className="rounded-lg bg-brand-red-light px-3 py-2 text-sm text-brand-red-dark">
              Some items are no longer available.{' '}
              <Link to="/cart" className="font-semibold underline">Remove them in your cart</Link> to continue.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-brand-red-light px-3 py-2 text-sm text-brand-red-dark">
              {error}{' '}
              {/no longer available/i.test(error) && <Link to="/cart" className="font-semibold underline">Go to cart</Link>}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || blocked || loading || !selectedBatch}
            className="w-full rounded-full bg-brand-red py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
          >
            {submitting ? 'Placing order…' : `Place order · ${formatGhs(total)}`}
          </button>
          <p className="text-xs text-brand-gray-500">
            Placing your order reserves these items for you for 24 hours while you pay.
          </p>
        </aside>
      </form>
    </div>
  )
}

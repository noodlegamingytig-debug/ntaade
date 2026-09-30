import { Link } from 'react-router-dom'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { CONDITION_LABELS } from '../../lib/conditionGrades'
import { formatGhs } from '../../lib/format'
import { resolveImageUrl } from '../../lib/imageUrl'
import { useCart } from '../../hooks/useCart'
import { useCartLines } from '../../hooks/useCartLines'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { PromoField } from './PromoField'

export function CartPage() {
  const cart = useCart()
  const { showToast } = useToast()
  const { lines, unavailable, subtotal, discount, loading, error, refresh } = useCartLines(cart.itemIds, cart.promoCode)
  const settings = useSettings()

  const hasAvailable = lines.length - unavailable.length > 0
  const deliveryFee = hasAvailable ? settings.number('delivery_fee_ghs') : 0
  const total = subtotal - discount + deliveryFee

  async function safeRemove(ids: string[]) {
    try {
      await cart.removeMany(ids)
    } catch {
      showToast('Could not update your cart. Try again.')
    }
  }

  if (cart.itemIds.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />
        <EmptyState
          title="Your cart is empty"
          description="Every piece is one of a kind, so once it's gone it's gone. Have a browse."
          action={
            <Link to="/" className="mt-2 rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark">
              Start shopping
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />
      <h1 className="mb-4 text-xl font-semibold text-brand-gray-900">Your cart</h1>

      {error && <ErrorState message={error} onRetry={refresh} />}

      <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
        <div>
          {unavailable.length > 0 && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-red-light px-4 py-3 text-sm text-brand-red-dark">
              <span>
                {unavailable.length === 1 ? '1 item in your cart is' : `${unavailable.length} items in your cart are`} no
                longer available. Remove {unavailable.length === 1 ? 'it' : 'them'} to check out.
              </span>
              <button
                type="button"
                onClick={() => safeRemove(unavailable.map((l) => l.itemId))}
                className="rounded-full bg-brand-red px-3 py-1 text-xs font-semibold text-white hover:bg-brand-red-dark"
              >
                Remove unavailable
              </button>
            </div>
          )}

          <ul className="divide-y divide-brand-gray-100">
            {loading && lines.length === 0
              ? cart.itemIds.map((id) => (
                  <li key={id} className="flex animate-pulse gap-3 py-4">
                    <div className="h-24 w-20 rounded-md bg-brand-gray-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 rounded bg-brand-gray-100" />
                      <div className="h-3 w-1/3 rounded bg-brand-gray-100" />
                    </div>
                  </li>
                ))
              : lines.map((line) => {
                  const discounted = line.discountGhs > 0.001
                  return (
                    <li key={line.itemId} className="flex gap-3 py-4">
                      <div className={`h-24 w-20 shrink-0 overflow-hidden rounded-md bg-brand-gray-100 ${line.isAvailable ? '' : 'opacity-50'}`}>
                        {line.imagePath && (
                          <img src={resolveImageUrl(line.imagePath)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${line.isAvailable ? 'text-brand-gray-900' : 'text-brand-gray-500 line-through'}`}>
                          {line.title}
                        </p>
                        {line.isAvailable ? (
                          <>
                            <p className="mt-0.5 text-xs text-brand-gray-500">
                              Size {line.size ?? '—'}
                              {line.conditionGrade && <> · {CONDITION_LABELS[line.conditionGrade]}</>}
                            </p>
                            <p className="mt-1 flex items-baseline gap-1.5">
                              <span className="text-sm font-semibold">{formatGhs(line.unitPriceGhs)}</span>
                              {discounted && (
                                <span className="text-xs text-brand-gray-400 line-through">{formatGhs(line.basePriceGhs)}</span>
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-xs font-semibold text-brand-red-dark">No longer available</p>
                        )}
                        <button
                          type="button"
                          onClick={() => safeRemove([line.itemId])}
                          className="mt-2 text-xs font-medium text-brand-gray-500 hover:text-brand-red hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  )
                })}
          </ul>
        </div>

        <aside className="h-fit space-y-4 rounded-lg border border-brand-gray-200 p-4">
          <PromoField />
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-brand-gray-600">Subtotal</dt>
              <dd>{formatGhs(subtotal)}</dd>
            </div>
            {discount > 0.001 && (
              <div className="flex justify-between text-brand-red-dark">
                <dt>Discounts</dt>
                <dd>−{formatGhs(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-brand-gray-600">Delivery</dt>
              <dd>{!settings.loaded ? '…' : deliveryFee > 0 ? formatGhs(deliveryFee) : 'Free'}</dd>
            </div>
            <div className="flex justify-between border-t border-brand-gray-200 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatGhs(total)}</dd>
            </div>
          </dl>
          {unavailable.length > 0 || loading || !hasAvailable ? (
            <button type="button" disabled className="w-full rounded-full bg-brand-red py-2.5 text-sm font-semibold text-white opacity-50">
              Checkout
            </button>
          ) : (
            <Link to="/checkout" className="block w-full rounded-full bg-brand-red py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-red-dark">
              Checkout
            </Link>
          )}
          <p className="text-xs text-brand-gray-500">
            Items aren't reserved until you place your order.
          </p>
        </aside>
      </div>
    </div>
  )
}

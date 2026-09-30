import { Link } from 'react-router-dom'
import { CONDITION_LABELS } from '../../lib/conditionGrades'
import { formatGhs, percentOff } from '../../lib/format'
import { resolveImageUrl } from '../../lib/imageUrl'
import { useCart } from '../../hooks/useCart'
import { useToast } from '../../hooks/useToast'
import type { CatalogItem } from '../../types/catalog'

export function ProductCard({ item }: { item: CatalogItem }) {
  const { showToast } = useToast()
  const cart = useCart()
  const inCart = cart.has(item.id)

  async function addToCart() {
    try {
      await cart.add(item.id)
      showToast('Added to cart')
    } catch {
      showToast('Could not add to cart. Please try again.')
    }
  }
  const isDiscounted = item.discountGhs > 0.001
  const off = isDiscounted ? percentOff(item.basePriceGhs, item.unitPriceGhs) : 0

  return (
    <div className="group relative">
      <Link to={`/product/${item.id}`} className="block">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-brand-gray-100">
          {item.imageUrl ? (
            <img
              src={resolveImageUrl(item.imageUrl)}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-brand-gray-400">
              No photo yet
            </div>
          )}
          {isDiscounted && (
            <span className="absolute left-2 top-2 rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-semibold text-white">
              -{off}%
            </span>
          )}
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="line-clamp-1 text-sm text-brand-gray-900">{item.title}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-brand-gray-900">
              {formatGhs(item.unitPriceGhs)}
            </span>
            {isDiscounted && (
              <span className="text-xs text-brand-gray-400 line-through">
                {formatGhs(item.basePriceGhs)}
              </span>
            )}
          </div>
          <p className="text-xs text-brand-gray-500">
            Size {item.size ?? '—'} · {CONDITION_LABELS[item.conditionGrade]}
          </p>
        </div>
      </Link>
      {inCart ? (
        <Link
          to="/cart"
          className="mt-2 block w-full rounded-full border border-brand-red bg-brand-red-light py-1.5 text-center text-xs font-medium text-brand-red-dark"
        >
          In cart · View
        </Link>
      ) : (
        <button
          type="button"
          onClick={addToCart}
          className="mt-2 w-full rounded-full border border-brand-gray-200 py-1.5 text-xs font-medium text-brand-gray-700 transition-colors hover:border-brand-red hover:text-brand-red"
        >
          Add to cart
        </button>
      )}
    </div>
  )
}

import { Link, useNavigate, useParams } from 'react-router-dom'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { ErrorState } from '../../components/ui/ErrorState'
import { ImageGallery } from '../../components/product/ImageGallery'
import { Measurements } from '../../components/product/Measurements'
import { useCart } from '../../hooks/useCart'
import { useToast } from '../../hooks/useToast'
import { CONDITION_EXPLANATIONS, CONDITION_LABELS } from '../../lib/conditionGrades'
import { formatGhs, percentOff } from '../../lib/format'
import { useProduct } from '../../hooks/useProduct'

export function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const { item, images, loading, error, notFound } = useProduct(id)
  const { showToast } = useToast()
  const cart = useCart()
  const navigate = useNavigate()

  async function addToCart(thenCheckout: boolean) {
    if (!item) return
    try {
      await cart.add(item.id)
      if (thenCheckout) navigate('/checkout')
      else showToast('Added to cart')
    } catch {
      showToast('Could not add to cart. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse px-4 py-6">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square rounded-lg bg-brand-gray-100" />
          <div className="space-y-3">
            <div className="h-5 w-2/3 rounded bg-brand-gray-100" />
            <div className="h-4 w-1/3 rounded bg-brand-gray-100" />
            <div className="h-24 w-full rounded bg-brand-gray-100" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ErrorState message={error} />
      </div>
    )
  }

  if (notFound || !item) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-brand-gray-900">This item isn't available anymore.</p>
        <p className="mt-1 text-sm text-brand-gray-500">
          It may have sold out or been taken down. Take a look at what's still in stock.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
        >
          Back to shop
        </Link>
      </div>
    )
  }

  const isDiscounted = item.discountGhs > 0.001
  const off = isDiscounted ? percentOff(item.basePriceGhs, item.unitPriceGhs) : 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          ...(item.categoryName
            ? [{ label: item.categoryName, to: `/?category=${item.categorySlug}` }]
            : []),
          { label: item.title },
        ]}
      />

      <div className="grid gap-8 md:grid-cols-2">
        <ImageGallery images={images} alt={item.title} />

        <div>
          <h1 className="text-xl font-semibold text-brand-gray-900">{item.title}</h1>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-brand-gray-900">
              {formatGhs(item.unitPriceGhs)}
            </span>
            {isDiscounted && (
              <>
                <span className="text-base text-brand-gray-400 line-through">
                  {formatGhs(item.basePriceGhs)}
                </span>
                <span className="rounded-full bg-brand-red-light px-2 py-0.5 text-xs font-semibold text-brand-red-dark">
                  -{off}%
                </span>
              </>
            )}
          </div>

          <p className="mt-3 text-sm font-medium text-brand-gray-900">
            Only 1 available — this item is one of a kind.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-brand-gray-100 px-3 py-1 text-brand-gray-700">
              Size {item.size ?? '—'}
            </span>
            <span className="rounded-full bg-brand-gray-100 px-3 py-1 text-brand-gray-700">
              {item.department.charAt(0).toUpperCase() + item.department.slice(1)}
            </span>
            <span className="rounded-full bg-brand-gray-100 px-3 py-1 text-brand-gray-700">
              Grade {item.conditionGrade} · {CONDITION_LABELS[item.conditionGrade]}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-brand-gray-500">
            {CONDITION_EXPLANATIONS[item.conditionGrade]}
          </p>

          {item.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-brand-gray-700">
              {item.description}
            </p>
          )}

          {Object.keys(item.measurements).length > 0 && (
            <div className="mt-5">
              <h2 className="mb-2 text-sm font-semibold text-brand-gray-900">Measurements</h2>
              <Measurements data={item.measurements} />
            </div>
          )}

          <div className="mt-6 flex gap-2">
            {cart.has(item.id) ? (
              <Link
                to="/cart"
                className="flex-1 rounded-full border border-brand-red bg-brand-red-light py-2.5 text-center text-sm font-semibold text-brand-red-dark"
              >
                In your cart · View
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => addToCart(false)}
                className="flex-1 rounded-full border border-brand-red py-2.5 text-sm font-semibold text-brand-red hover:bg-brand-red-light"
              >
                Add to cart
              </button>
            )}
            <button
              type="button"
              onClick={() => addToCart(true)}
              className="flex-1 rounded-full bg-brand-red py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark"
            >
              Buy now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

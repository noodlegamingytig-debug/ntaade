import { useEffect } from 'react'
import type { CatalogFilters } from '../../types/catalog'
import type { Category } from '../../hooks/useCategories'
import { FilterControls } from './FilterControls'

interface FilterDrawerProps {
  open: boolean
  onClose: () => void
  filters: CatalogFilters
  setFilters: (patch: Partial<CatalogFilters>) => void
  clearFilters: () => void
  activeFilterCount: number
  categories: Category[]
  sizes: string[]
  resultCount: number
}

/** Mobile slide-up filter drawer. */
export function FilterDrawer(props: FilterDrawerProps) {
  useEffect(() => {
    if (!props.open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [props.open])

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        aria-label="Close filters"
        onClick={props.onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-brand-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-brand-gray-900">Filters</h2>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-brand-gray-500 hover:bg-brand-gray-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <FilterControls
            filters={props.filters}
            setFilters={props.setFilters}
            categories={props.categories}
            sizes={props.sizes}
            idPrefix="drawer"
          />
        </div>
        <div className="flex gap-2 border-t border-brand-gray-200 px-4 py-3">
          {props.activeFilterCount > 0 && (
            <button
              type="button"
              onClick={props.clearFilters}
              className="flex-1 rounded-full border border-brand-gray-200 py-2.5 text-sm font-medium text-brand-gray-700"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={props.onClose}
            className="flex-1 rounded-full bg-brand-red py-2.5 text-sm font-semibold text-white"
          >
            Show {props.resultCount} result{props.resultCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}

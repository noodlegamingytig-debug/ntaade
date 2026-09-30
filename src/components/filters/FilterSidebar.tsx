import type { CatalogFilters } from '../../types/catalog'
import type { Category } from '../../hooks/useCategories'
import { FilterControls } from './FilterControls'

interface FilterSidebarProps {
  filters: CatalogFilters
  setFilters: (patch: Partial<CatalogFilters>) => void
  clearFilters: () => void
  activeFilterCount: number
  categories: Category[]
  sizes: string[]
}

export function FilterSidebar(props: FilterSidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-gray-900">Filters</h2>
        {props.activeFilterCount > 0 && (
          <button
            type="button"
            onClick={props.clearFilters}
            className="text-xs font-medium text-brand-red hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      <FilterControls
        filters={props.filters}
        setFilters={props.setFilters}
        categories={props.categories}
        sizes={props.sizes}
        idPrefix="sidebar"
      />
    </aside>
  )
}

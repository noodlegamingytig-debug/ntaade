import { useState } from 'react'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { SkeletonGrid } from '../../components/ui/Skeletons'
import { FilterDrawer } from '../../components/filters/FilterDrawer'
import { FilterSidebar } from '../../components/filters/FilterSidebar'
import { SortDropdown } from '../../components/filters/SortDropdown'
import { ProductCard } from '../../components/product/ProductCard'
import { useCategories } from '../../hooks/useCategories'
import { useAvailableSizes, useCatalog } from '../../hooks/useCatalog'
import { useCatalogFilters } from '../../hooks/useCatalogFilters'

export function CatalogPage() {
  const { categories } = useCategories()
  const { filters, setFilters, clearFilters, activeFilterCount } = useCatalogFilters(categories)
  const { items, loading, error } = useCatalog(filters, categories)
  const sizes = useAvailableSizes()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const activeCategory = filters.categoryId
    ? categories.find((c) => c.id === filters.categoryId)
    : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
        ]}
      />

      <div className="flex gap-8">
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          clearFilters={clearFilters}
          activeFilterCount={activeFilterCount}
          categories={categories}
          sizes={sizes}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-brand-gray-200 px-3 py-1.5 text-sm font-medium text-brand-gray-700 lg:hidden"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <p className="hidden text-sm text-brand-gray-500 sm:block">
              {loading ? 'Loading…' : `${items.length} item${items.length === 1 ? '' : 's'}`}
            </p>
            <SortDropdown value={filters.sort} onChange={(sort) => setFilters({ sort })} />
          </div>

          {error && <ErrorState message={error} />}

          {!error && loading && <SkeletonGrid />}

          {!error && !loading && items.length === 0 && (
            <EmptyState
              title="No items match these filters"
              description="Try widening your search or clearing a filter."
              action={
                activeFilterCount > 0 || filters.search ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearFilters()
                      setFilters({ search: '' })
                    }}
                    className="mt-2 rounded-full bg-brand-red px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-red-dark"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          )}

          {!error && !loading && items.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        setFilters={setFilters}
        clearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
        categories={categories}
        sizes={sizes}
        resultCount={items.length}
      />
    </div>
  )
}

import type { CatalogFilters } from '../../types/catalog'
import type { ConditionGrade, Department } from '../../types/database'
import { CONDITION_LABELS } from '../../lib/conditionGrades'
import type { Category } from '../../hooks/useCategories'

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'unisex', label: 'Unisex' },
]

const GRADES: ConditionGrade[] = ['A', 'B', 'C']

interface FilterControlsProps {
  filters: CatalogFilters
  setFilters: (patch: Partial<CatalogFilters>) => void
  categories: Category[]
  sizes: string[]
  /** Keeps radio group names unique when two copies (sidebar + drawer) are mounted. */
  idPrefix: string
}

/** The actual filter form fields, shared between the desktop sidebar and
 * the mobile drawer so the two never drift out of sync. */
export function FilterControls({ filters, setFilters, categories, sizes, idPrefix }: FilterControlsProps) {
  const topLevelCategories = categories.filter((c) => !c.parent_id)

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-brand-gray-900">Department</legend>
        <div className="space-y-1.5">
          {DEPARTMENTS.map((dep) => (
            <label key={dep.value} className="flex items-center gap-2 text-sm text-brand-gray-700">
              <input
                type="radio"
                name={`${idPrefix}-department`}
                checked={filters.department === dep.value}
                onChange={() =>
                  setFilters({ department: filters.department === dep.value ? null : dep.value })
                }
                className="accent-brand-red"
              />
              {dep.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-brand-gray-900">Category</legend>
        <div className="space-y-1.5">
          {topLevelCategories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm text-brand-gray-700">
              <input
                type="radio"
                name={`${idPrefix}-category`}
                checked={filters.categoryId === cat.id}
                onChange={() =>
                  setFilters({ categoryId: filters.categoryId === cat.id ? null : cat.id })
                }
                className="accent-brand-red"
              />
              {cat.name}
            </label>
          ))}
        </div>
      </fieldset>

      {sizes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-brand-gray-900">Size</legend>
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((size) => {
              const active = filters.size === size
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setFilters({ size: active ? null : size })}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-brand-red bg-brand-red-light text-brand-red-dark'
                      : 'border-brand-gray-200 text-brand-gray-700 hover:border-brand-gray-400'
                  }`}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-brand-gray-900">Price (GHS)</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Min"
            value={filters.minPrice ?? ''}
            onChange={(e) =>
              setFilters({ minPrice: e.target.value === '' ? null : Number(e.target.value) })
            }
            className="w-full rounded-md border border-brand-gray-200 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          <span className="text-brand-gray-400">–</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Max"
            value={filters.maxPrice ?? ''}
            onChange={(e) =>
              setFilters({ maxPrice: e.target.value === '' ? null : Number(e.target.value) })
            }
            className="w-full rounded-md border border-brand-gray-200 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-brand-gray-900">Condition</legend>
        <div className="space-y-1.5">
          {GRADES.map((grade) => (
            <label key={grade} className="flex items-center gap-2 text-sm text-brand-gray-700">
              <input
                type="radio"
                name={`${idPrefix}-condition`}
                checked={filters.conditionGrade === grade}
                onChange={() =>
                  setFilters({ conditionGrade: filters.conditionGrade === grade ? null : grade })
                }
                className="accent-brand-red"
              />
              {grade} — {CONDITION_LABELS[grade]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium text-brand-gray-900">
        <input
          type="checkbox"
          checked={filters.onSaleOnly}
          onChange={(e) => setFilters({ onSaleOnly: e.target.checked })}
          className="accent-brand-red"
        />
        On sale only
      </label>
    </div>
  )
}

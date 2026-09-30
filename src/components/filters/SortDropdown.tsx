import type { SortOption } from '../../types/catalog'

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount_desc', label: 'Biggest discount' },
]

export function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption
  onChange: (value: SortOption) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-brand-gray-600">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="rounded-md border border-brand-gray-200 bg-white py-1.5 pl-2 pr-7 text-sm text-brand-gray-900 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

import { useEffect, useState } from 'react'

interface SearchBarProps {
  value: string
  onSearch: (value: string) => void
  className?: string
}

/** Debounced text search input. Calls onSearch ~400ms after typing
 * stops, and immediately on submit (Enter). */
export function SearchBar({ value, onSearch, className = '' }: SearchBarProps) {
  const [draft, setDraft] = useState(value)

  // keep the input in sync if the URL changes from elsewhere (e.g. "clear filters")
  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onSearch(draft)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  return (
    <form
      role="search"
      className={`flex items-center gap-2 ${className}`}
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(draft)
      }}
    >
      <div className="relative w-full">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search tops, dresses, sizes…"
          aria-label="Search items"
          className="w-full rounded-full border border-brand-gray-200 bg-brand-gray-50 py-2 pl-9 pr-3 text-sm text-brand-gray-900 placeholder:text-brand-gray-400 focus:border-brand-red focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>
    </form>
  )
}

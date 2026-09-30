import { Link } from 'react-router-dom'

interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm text-brand-gray-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-brand-gray-300">/</span>}
            {item.to ? (
              <Link to={item.to} className="hover:text-brand-red hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-brand-gray-700">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

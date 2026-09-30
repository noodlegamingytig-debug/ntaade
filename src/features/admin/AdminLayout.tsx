import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/items', label: 'Items' },
  { to: '/admin/batches', label: 'Batches' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/promotions', label: 'Promotions' },
  { to: '/admin/settings', label: 'Settings' },
]

export function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <nav aria-label="Admin" className="no-print -mx-4 mb-5 overflow-x-auto border-b border-brand-gray-200 px-4 print:hidden">
        <ul className="flex gap-1 whitespace-nowrap">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `block border-b-2 px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'border-brand-red text-brand-red'
                      : 'border-transparent text-brand-gray-600 hover:text-brand-gray-900'
                  }`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}

import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/** Route guard for /admin/*. The database enforces admin-only access regardless; this just keeps the UI tidy. */
export function RequireAdmin() {
  const { user, profile, loading, profileLoading } = useAuth()
  const location = useLocation()

  if (loading || (user && profileLoading)) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-brand-gray-500">Loading…</div>
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/signin?next=${next}`} replace />
  }
  if (profile?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-medium text-brand-gray-900">This area is for Ntaade admins.</p>
        <p className="mt-1 text-sm text-brand-gray-500">Your account doesn't have admin access.</p>
        <Link to="/" className="mt-4 inline-block rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark">
          Back to shop
        </Link>
      </div>
    )
  }
  return <Outlet />
}

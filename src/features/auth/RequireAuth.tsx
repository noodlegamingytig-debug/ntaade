import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/** Route guard: sends signed-out visitors to /signin and brings them back afterwards. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-brand-gray-500">Loading…</div>
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/signin?next=${next}`} replace />
  }
  return <Outlet />
}

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const iconProps = { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8 } as const

export function AccountMenu() {
  const { user, profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return (
      <Link
        to={`/signin?next=${next}`}
        aria-label="Sign in"
        className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-brand-gray-700 hover:bg-brand-gray-100"
      >
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="3.2" />
          <path strokeLinecap="round" d="M5 20c1.4-3.6 4.2-5.4 7-5.4s5.6 1.8 7 5.4" />
        </svg>
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    )
  }

  const initial = (profile?.full_name || user.email || '?').trim().charAt(0).toUpperCase()
  const item = 'block w-full px-4 py-2 text-left text-sm text-brand-gray-700 hover:bg-brand-gray-50'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gray-900 text-sm font-semibold text-white"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-lg border border-brand-gray-200 bg-white py-1 shadow-lg">
          <p className="truncate border-b border-brand-gray-100 px-4 py-2 text-xs text-brand-gray-500">{user.email}</p>
          <Link role="menuitem" to="/orders" onClick={() => setOpen(false)} className={item}>My orders</Link>
          {profile?.role === 'admin' && (
            <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className={item}>Admin</Link>
          )}
          <button role="menuitem" type="button" onClick={() => { setOpen(false); void signOut() }} className={item}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

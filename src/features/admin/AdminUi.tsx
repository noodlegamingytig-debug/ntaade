import type { ReactNode } from 'react'
import { ErrorState } from '../../components/ui/ErrorState'

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold text-brand-gray-900">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-brand-gray-700">
      <span className="font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-xs text-brand-gray-500">{hint}</span>}
    </label>
  )
}

export function Loading() {
  return <div className="h-40 animate-pulse rounded-lg bg-brand-gray-100" aria-label="Loading" />
}

export function QueryError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <ErrorState message={message} onRetry={onRetry} />
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-3 py-2 text-sm ${
        tone === 'error' ? 'bg-brand-red-light text-brand-red-dark' : 'bg-brand-gray-100 text-brand-gray-700'
      }`}
    >
      {children}
    </p>
  )
}

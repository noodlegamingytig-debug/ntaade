import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center">
      <p className="text-lg font-medium text-brand-gray-900">Page not found</p>
      <Link
        to="/"
        className="mt-4 inline-block rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
      >
        Back to shop
      </Link>
    </div>
  )
}

import { useToast } from '../../hooks/useToast'

export function CartIcon({ count = 0 }: { count?: number }) {
  const { showToast } = useToast()

  return (
    <button
      type="button"
      onClick={() => showToast('Cart & checkout arrive in Phase 3.')}
      aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-brand-gray-700 hover:bg-brand-gray-100"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h1.5l1.9 10.5A2 2 0 0 0 8.36 15h8.28a2 2 0 0 0 1.96-1.6L20 6H6"
        />
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  )
}

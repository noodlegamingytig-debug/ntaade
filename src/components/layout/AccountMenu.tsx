import { useToast } from '../../hooks/useToast'

export function AccountMenu() {
  const { showToast } = useToast()

  return (
    <button
      type="button"
      onClick={() => showToast('Sign-in arrives in Phase 3.')}
      aria-label="Account"
      className="flex h-9 w-9 items-center justify-center rounded-full text-brand-gray-700 hover:bg-brand-gray-100"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <circle cx="12" cy="8" r="3.2" />
        <path strokeLinecap="round" d="M5 20c1.4-3.6 4.2-5.4 7-5.4s5.6 1.8 7 5.4" />
      </svg>
    </button>
  )
}

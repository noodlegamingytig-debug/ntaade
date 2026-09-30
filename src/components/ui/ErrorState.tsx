export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-brand-red-light px-6 py-12 text-center">
      <p className="font-medium text-brand-red-dark">Something went wrong</p>
      <p className="max-w-sm text-sm text-brand-red-dark/80">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-brand-red px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-red-dark"
        >
          Try again
        </button>
      )}
    </div>
  )
}

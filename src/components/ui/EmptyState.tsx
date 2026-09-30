interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-brand-gray-200 px-6 py-16 text-center">
      <svg
        className="mb-1 h-10 w-10 text-brand-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
      <p className="font-medium text-brand-gray-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-brand-gray-500">{description}</p>}
      {action}
    </div>
  )
}

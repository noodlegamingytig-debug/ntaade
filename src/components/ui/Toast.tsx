import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from '../../hooks/useToast'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setMessage(null), 2800)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-lg bg-brand-gray-900 px-4 py-3 text-center text-sm text-white shadow-lg sm:inset-x-auto sm:right-4"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

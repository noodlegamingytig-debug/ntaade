import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

/**
 * Phase 1 placeholder. This just proves the Supabase connection and
 * public items_public view work end to end. The real catalog UI,
 * routing, cart, checkout, and admin screens come in Phases 2-4.
 */
function App() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [itemCount, setItemCount] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('items_public')
      .select('*', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (cancelled) return
        if (error) {
          setStatus('error')
          setErrorMessage(error.message)
          return
        }
        setStatus('ok')
        setItemCount(count ?? 0)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold text-brand-red">Ntaade</h1>
      <p className="max-w-sm text-brand-gray-600">
        Phase 1 (database &amp; security) is set up. The shopping UI arrives in Phase 2.
      </p>
      {status === 'checking' && <p className="text-brand-gray-500">Checking Supabase connection…</p>}
      {status === 'ok' && (
        <p className="rounded-lg bg-brand-gray-100 px-4 py-2 text-brand-gray-700">
          Connected — {itemCount} available item{itemCount === 1 ? '' : 's'} in the catalog.
        </p>
      )}
      {status === 'error' && (
        <p className="max-w-md rounded-lg bg-brand-red-light px-4 py-2 text-brand-red-dark">
          Could not reach Supabase: {errorMessage}. Check your .env values against .env.example.
        </p>
      )}
    </main>
  )
}

export default App

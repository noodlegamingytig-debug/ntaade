import { useCallback, useEffect, useRef, useState } from 'react'

/** Turns a Supabase `{ data, error }` result into data or a thrown Error. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

type State<T> = { key: string; data?: T; error?: string }

/**
 * Small data-loading hook for the admin screens. Re-runs when `key` changes or
 * `reload()` is called, and keeps showing the previous data while it refreshes so
 * lists don't flash empty after every edit.
 */
export function useAdminQuery<T>(fetcher: () => Promise<T>, key: string) {
  const [state, setState] = useState<State<T> | null>(null)
  const [tick, setTick] = useState(0)
  const fetchRef = useRef(fetcher)
  useEffect(() => {
    fetchRef.current = fetcher
  })

  const current = `${key}#${tick}`
  useEffect(() => {
    let cancelled = false
    fetchRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ key: current, data })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState((prev) => ({
            key: current,
            data: prev?.data,
            error: err instanceof Error ? err.message : 'Something went wrong.',
          }))
      })
    return () => {
      cancelled = true
    }
  }, [current])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return {
    data: state?.data,
    error: state?.error ?? null,
    loading: state === null,
    refreshing: state !== null && state.key !== current,
    reload,
  }
}

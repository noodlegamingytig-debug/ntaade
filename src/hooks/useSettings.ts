import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Public admin-editable settings (delivery fee, payment instructions). */
export function useSettings() {
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('settings')
      .select('key, value')
      .then(({ data }) => {
        if (cancelled) return
        setSettings(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])))
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const text = (key: string, fallback = '') => {
    const v = settings[key]
    return typeof v === 'string' ? v : fallback
  }
  const number = (key: string, fallback = 0) => {
    const v = Number(settings[key])
    return Number.isFinite(v) ? v : fallback
  }

  return { settings, loaded, text, number }
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Database } from '../types/database'

export type Category = Database['public']['Tables']['categories']['Row']

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
        } else {
          setCategories(data ?? [])
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { categories, loading, error }
}

/** A category and every descendant category id (itself included) — used
 * so filtering by a parent category also matches items in its
 * subcategories. */
export function descendantCategoryIds(categories: Category[], categoryId: string): string[] {
  const ids = [categoryId]
  let frontier = [categoryId]
  while (frontier.length > 0) {
    const children = categories.filter((c) => c.parent_id && frontier.includes(c.parent_id))
    if (children.length === 0) break
    ids.push(...children.map((c) => c.id))
    frontier = children.map((c) => c.id)
  }
  return ids
}

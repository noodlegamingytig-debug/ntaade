import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CatalogFilters, SortOption } from '../types/catalog'
import type { ConditionGrade, Department } from '../types/database'
import type { Category } from './useCategories'

const VALID_SORTS: SortOption[] = ['newest', 'price_asc', 'price_desc', 'discount_desc']
const VALID_DEPARTMENTS: Department[] = ['men', 'women', 'unisex']
const VALID_GRADES: ConditionGrade[] = ['A', 'B', 'C']

/** Keeps catalog filters in sync with the URL's query string, so a
 * filtered/sorted/searched view can be shared or bookmarked. */
export function useCatalogFilters(categories: Category[]) {
  const [searchParams, setSearchParams] = useSearchParams()

  const categoryBySlug = useMemo(
    () => new Map(categories.map((c) => [c.slug, c])),
    [categories],
  )

  const filters: CatalogFilters = useMemo(() => {
    const departmentRaw = searchParams.get('department')
    const gradeRaw = searchParams.get('condition')
    const sortRaw = searchParams.get('sort')
    const categorySlug = searchParams.get('category')
    const min = searchParams.get('min')
    const max = searchParams.get('max')

    return {
      department: VALID_DEPARTMENTS.includes(departmentRaw as Department)
        ? (departmentRaw as Department)
        : null,
      categoryId: categorySlug ? (categoryBySlug.get(categorySlug)?.id ?? null) : null,
      size: searchParams.get('size'),
      minPrice: min ? Number(min) : null,
      maxPrice: max ? Number(max) : null,
      conditionGrade: VALID_GRADES.includes(gradeRaw as ConditionGrade)
        ? (gradeRaw as ConditionGrade)
        : null,
      onSaleOnly: searchParams.get('sale') === '1',
      search: searchParams.get('q') ?? '',
      sort: VALID_SORTS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : 'newest',
    }
  }, [searchParams, categoryBySlug])

  const setFilters = useCallback(
    (patch: Partial<CatalogFilters>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const merged = { ...filters, ...patch }

          const setOrDelete = (key: string, value: string | null | undefined) => {
            if (value) next.set(key, value)
            else next.delete(key)
          }

          setOrDelete('department', merged.department)
          const categorySlug = merged.categoryId
            ? categories.find((c) => c.id === merged.categoryId)?.slug
            : null
          setOrDelete('category', categorySlug)
          setOrDelete('size', merged.size)
          setOrDelete('min', merged.minPrice != null ? String(merged.minPrice) : null)
          setOrDelete('max', merged.maxPrice != null ? String(merged.maxPrice) : null)
          setOrDelete('condition', merged.conditionGrade)
          setOrDelete('sale', merged.onSaleOnly ? '1' : null)
          setOrDelete('q', merged.search || null)
          setOrDelete('sort', merged.sort !== 'newest' ? merged.sort : null)

          return next
        },
        { replace: true },
      )
    },
    [filters, categories, setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const key of ['department', 'category', 'size', 'min', 'max', 'condition', 'sale']) {
          next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const activeFilterCount = [
    filters.department,
    filters.categoryId,
    filters.size,
    filters.minPrice,
    filters.maxPrice,
    filters.conditionGrade,
    filters.onSaleOnly || null,
  ].filter(Boolean).length

  return { filters, setFilters, clearFilters, activeFilterCount }
}

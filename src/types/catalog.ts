import type { ConditionGrade, Department } from './database'

/** An items_public row enriched with its primary image and the
 * server-computed effective price (item sale + promotions, whichever is
 * best — see compute_item_price() in the database). */
export interface CatalogItem {
  id: string
  title: string
  description: string | null
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  department: Department
  size: string | null
  measurements: Record<string, number | string>
  conditionGrade: ConditionGrade
  basePriceGhs: number
  unitPriceGhs: number
  discountGhs: number
  isOnSale: boolean
  promoName: string | null
  createdAt: string
  imageUrl: string | null
  imageCount: number
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'discount_desc'

export interface CatalogFilters {
  department: Department | null
  categoryId: string | null
  size: string | null
  minPrice: number | null
  maxPrice: number | null
  conditionGrade: ConditionGrade | null
  onSaleOnly: boolean
  search: string
  sort: SortOption
}

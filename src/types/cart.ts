import type { ConditionGrade } from './database'

export interface CartLine {
  itemId: string
  title: string
  size: string | null
  conditionGrade: ConditionGrade | null
  isAvailable: boolean
  imagePath: string | null
  basePriceGhs: number
  unitPriceGhs: number
  discountGhs: number
  promoName: string | null
}

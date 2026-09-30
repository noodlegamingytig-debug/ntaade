// Hand-authored to match supabase/migrations/*.sql. Once you have a real
// Supabase project, regenerate this from the live schema with:
//   npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts
// and re-apply any manual additions (there are none currently).

export type Department = 'men' | 'women' | 'unisex'
export type ConditionGrade = 'A' | 'B' | 'C'
export type ItemStatus = 'available' | 'reserved' | 'sold' | 'hidden' | 'expired'
export type OrderStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'expired'
export type BatchStatus = 'open' | 'closed' | 'completed'
export type ProfileRole = 'student' | 'admin'
export type PromotionType = 'percent' | 'fixed'
export type PromotionScope = 'all' | 'category' | 'items'

// --- Row shapes, defined standalone (not self-referencing Database) so
// TypeScript can resolve them without a circular-lookup problem. ---

export type ProfileRow = {
  id: string
  full_name: string | null
  phone: string | null
  role: ProfileRole
  created_at: string
}

export type VendorRow = {
  id: string
  code_name: string
  notes: string | null
  created_at: string
}

export type CategoryRow = {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export type ItemRow = {
  id: string
  vendor_id: string | null
  title: string
  description: string | null
  category_id: string | null
  department: Department
  size: string | null
  measurements: Record<string, number | string>
  condition_grade: ConditionGrade
  base_price_ghs: number
  sale_price_ghs: number | null
  sale_starts_at: string | null
  sale_ends_at: string | null
  status: ItemStatus
  created_at: string
  expires_at: string | null
}

export type ItemImageRow = {
  id: string
  item_id: string
  storage_path: string
  position: number
}

export type OrderBatchRow = {
  id: string
  closes_at: string
  delivery_date: string | null
  pickup_point: string | null
  status: BatchStatus
  created_at: string
}

export type OrderRow = {
  id: string
  student_id: string
  batch_id: string
  subtotal_ghs: number
  discount_total_ghs: number
  delivery_fee_ghs: number
  total_ghs: number
  status: OrderStatus
  payment_reference: string | null
  promo_code: string | null
  hold_expires_at: string
  created_at: string
}

export type OrderItemRow = {
  id: string
  order_id: string
  item_id: string
  price_paid_ghs: number
  title_snapshot: string
}

export type CartItemRow = {
  id: string
  student_id: string
  item_id: string
  added_at: string
}

export type PromotionRow = {
  id: string
  name: string
  type: PromotionType
  value: number
  scope: PromotionScope
  scope_category_id: string | null
  scope_item_ids: string[] | null
  code: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
}

export type SettingRow = {
  key: string
  value: unknown
  updated_at: string
}

export type ItemsPublicRow = {
  id: string
  title: string
  description: string | null
  category_id: string | null
  category_name: string | null
  category_slug: string | null
  department: Department
  size: string | null
  measurements: Record<string, number | string>
  condition_grade: ConditionGrade
  base_price_ghs: number
  current_price_ghs: number
  is_on_sale: boolean
  status: ItemStatus
  created_at: string
  expires_at: string | null
}

// --- Assembled Database type, for createClient<Database>(). ---

type TableDef<Row, InsertExtra extends keyof Row = never> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, InsertExtra>
  Update: Partial<Row>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, 'id'>
      vendors: TableDef<VendorRow>
      categories: TableDef<CategoryRow>
      items: TableDef<ItemRow>
      item_images: TableDef<ItemImageRow>
      order_batches: TableDef<OrderBatchRow>
      orders: TableDef<OrderRow>
      order_items: TableDef<OrderItemRow>
      cart_items: TableDef<CartItemRow>
      promotions: TableDef<PromotionRow>
      settings: TableDef<SettingRow, 'key'>
    }
    Views: {
      items_public: {
        Row: ItemsPublicRow
        Relationships: []
      }
    }
    Functions: {
      checkout: {
        Args: { p_batch_id: string; p_item_ids: string[]; p_promo_code?: string | null }
        Returns: {
          order_id: string
          subtotal_ghs: number
          discount_total_ghs: number
          delivery_fee_ghs: number
          total_ghs: number
          hold_expires_at: string
        }[]
      }
      get_cart_lines: {
        Args: { p_item_ids: string[]; p_promo_code?: string | null }
        Returns: {
          item_id: string
          title: string
          size: string | null
          condition_grade: ConditionGrade
          is_available: boolean
          image_path: string | null
          base_price_ghs: number
          unit_price_ghs: number
          discount_ghs: number
          promo_name: string | null
        }[]
      }
      check_promo_code: {
        Args: { p_code: string }
        Returns: { promo_name: string }[]
      }
      submit_payment_reference: {
        Args: { p_order_id: string; p_reference: string }
        Returns: undefined
      }
      cancel_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      get_effective_prices: {
        Args: { p_item_ids: string[]; p_promo_code?: string | null }
        Returns: {
          item_id: string
          base_price_ghs: number
          unit_price_ghs: number
          discount_ghs: number
          is_on_sale: boolean
          promo_name: string | null
        }[]
      }
    }
  }
}

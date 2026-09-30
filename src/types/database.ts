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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          role: ProfileRole
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      vendors: {
        Row: {
          id: string
          code_name: string
          notes: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['vendors']['Row']>
        Update: Partial<Database['public']['Tables']['vendors']['Row']>
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          parent_id: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['categories']['Row']>
        Update: Partial<Database['public']['Tables']['categories']['Row']>
      }
      items: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['items']['Row']>
        Update: Partial<Database['public']['Tables']['items']['Row']>
      }
      item_images: {
        Row: {
          id: string
          item_id: string
          storage_path: string
          position: number
        }
        Insert: Partial<Database['public']['Tables']['item_images']['Row']>
        Update: Partial<Database['public']['Tables']['item_images']['Row']>
      }
      order_batches: {
        Row: {
          id: string
          closes_at: string
          delivery_date: string | null
          pickup_point: string | null
          status: BatchStatus
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['order_batches']['Row']>
        Update: Partial<Database['public']['Tables']['order_batches']['Row']>
      }
      orders: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['orders']['Row']>
        Update: Partial<Database['public']['Tables']['orders']['Row']>
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          item_id: string
          price_paid_ghs: number
          title_snapshot: string
        }
        Insert: Partial<Database['public']['Tables']['order_items']['Row']>
        Update: Partial<Database['public']['Tables']['order_items']['Row']>
      }
      cart_items: {
        Row: {
          id: string
          student_id: string
          item_id: string
          added_at: string
        }
        Insert: Partial<Database['public']['Tables']['cart_items']['Row']>
        Update: Partial<Database['public']['Tables']['cart_items']['Row']>
      }
      promotions: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['promotions']['Row']>
        Update: Partial<Database['public']['Tables']['promotions']['Row']>
      }
      settings: {
        Row: {
          key: string
          value: unknown
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['settings']['Row']> & { key: string }
        Update: Partial<Database['public']['Tables']['settings']['Row']>
      }
    }
    Views: {
      items_public: {
        Row: {
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

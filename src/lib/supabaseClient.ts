import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.',
  )
}

// Single shared client. Only the anon key is ever used here — the service
// role key must never be imported into frontend code.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // The app uses hash-based routing (so the built index.html works from file:// and on
    // Netlify alike). Sign-in uses a one-time code typed into the app rather than an emailed
    // redirect link, so there is never a "#access_token=..." fragment to parse.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
})

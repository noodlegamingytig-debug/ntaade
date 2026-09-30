import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { ProfileRow } from '../../types/database'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  /** True until the stored session (if any) has been read. */
  loading: boolean
  /** True while a signed-in user's profile row is still being fetched. */
  profileLoading: boolean
  /** Each returns an error message to show, or null on success. */
  requestCode: (email: string) => Promise<string | null>
  verifyCode: (email: string, code: string) => Promise<string | null>
  updateProfile: (patch: { full_name?: string; phone?: string }) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

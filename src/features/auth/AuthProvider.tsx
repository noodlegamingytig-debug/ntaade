import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import { isAshesiEmail } from '../../lib/ashesiEmail'
import type { ProfileRow } from '../../types/database'
import { AuthContext, type AuthContextValue } from './authContext'

function friendlyAuthError(message: string): string {
  if (/database error saving new user/i.test(message)) {
    return 'Only @ashesi.edu.gh email addresses can sign up.'
  }
  if (/rate limit|security purposes|too many/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileState, setProfileState] = useState<{ userId: string; profile: ProfileRow | null } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    // Keep this callback synchronous: calling other supabase APIs inside it can deadlock.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfileState({ userId, profile: data })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const profile = profileState && profileState.userId === userId ? profileState.profile : null
  const profileLoading = userId !== null && profileState?.userId !== userId

  const requestCode = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase()
    if (!isAshesiEmail(clean)) return 'Use your @ashesi.edu.gh email address.'
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true },
    })
    return error ? friendlyAuthError(error.message) : null
  }, [])

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    return error ? 'That code is wrong or has expired. Request a new one.' : null
  }, [])

  const updateProfile = useCallback(
    async (patch: { full_name?: string; phone?: string }) => {
      if (!userId) return 'Not signed in.'
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select('*')
        .maybeSingle()
      if (error) return error.message
      if (data) setProfileState({ userId, profile: data })
      return null
    },
    [userId],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value: AuthContextValue = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      requestCode,
      verifyCode,
      updateProfile,
      signOut,
    }),
    [session, profile, loading, profileLoading, requestCode, verifyCode, updateProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

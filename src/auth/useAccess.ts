import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type Access =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'denied'; email: string }
  | { status: 'allowed'; email: string }
  | { status: 'error'; message: string }

/** The signed-in user and whether their email is on house.allowed_emails. */
export const useAccess = (): Access => {
  const [session, setSession] = useState<Session | null | undefined>(isSupabaseConfigured ? undefined : null)
  const [allowed, setAllowed] = useState<{ userId: string; ok: boolean } | { userId: string; error: string }>()

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase.rpc('is_allowed').then(({ data, error }) => {
      if (cancelled) return
      setAllowed(error ? { userId, error: error.message } : { userId, ok: data === true })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (session === undefined) return { status: 'loading' }
  if (session === null) return { status: 'signed-out' }
  const email = session.user.email ?? ''
  if (!allowed || allowed.userId !== session.user.id) return { status: 'loading' }
  if ('error' in allowed) return { status: 'error', message: allowed.error }
  return allowed.ok ? { status: 'allowed', email } : { status: 'denied', email }
}

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })

export const signOut = () => supabase.auth.signOut()

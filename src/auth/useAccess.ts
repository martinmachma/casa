import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { queryClient } from '../lib/queryClient'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type Access =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'denied'; email: string }
  | { status: 'allowed'; email: string; nickname?: string }
  | { status: 'error'; message: string }

/** The signed-in user and whether their email is on house.allowed_emails. */
export const useAccess = (): Access => {
  const [session, setSession] = useState<Session | null | undefined>(isSupabaseConfigured ? undefined : null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Whatever was loaded belonged to the one who signed out.
      if (event === 'SIGNED_OUT') queryClient.clear()
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const check = useQuery({
    queryKey: ['access', userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async () => {
      const [allowed, nickname] = await Promise.all([supabase.rpc('is_allowed'), supabase.rpc('my_nickname')])
      if (allowed.error) throw new Error(allowed.error.message)
      return { ok: allowed.data === true, nickname: (nickname.data as string | null) ?? undefined }
    },
  })

  if (session === undefined) return { status: 'loading' }
  if (session === null) return { status: 'signed-out' }
  const email = session.user.email ?? ''
  if (check.isError) return { status: 'error', message: check.error.message }
  if (!check.data) return { status: 'loading' }
  return check.data.ok ? { status: 'allowed', email, nickname: check.data.nickname } : { status: 'denied', email }
}

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })

export const signOut = () => supabase.auth.signOut()

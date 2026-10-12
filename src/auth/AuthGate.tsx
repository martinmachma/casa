import { useState, type ReactNode } from 'react'
import { localBackend } from '../data/localBackend'
import { supabaseBackend } from '../data/supabaseBackend'
import type { Backend } from '../data/types'
import { isSupabaseConfigured } from '../lib/supabase'
import { signInWithGoogle, signOut, useAccess } from './useAccess'

export type Account = { label: string; signOut: () => void }

type AuthGateProps = {
  children: (backend: Backend, account: Account) => ReactNode
}

// The demo lets the 3D view be tried before Supabase is set up; it saves to this browser only.
const DEMO_AVAILABLE = import.meta.env.DEV || !isSupabaseConfigured

export const AuthGate = ({ children }: AuthGateProps) => {
  const access = useAccess()
  const [demo, setDemo] = useState(false)
  const [error, setError] = useState<string>()

  if (demo) return children(localBackend, { label: 'Demo (this browser only)', signOut: () => setDemo(false) })
  if (access.status === 'allowed') return children(supabaseBackend, { label: access.email, signOut })

  const signIn = async () => {
    setError(undefined)
    const { error: e } = await signInWithGoogle()
    if (e) setError(e.message)
  }

  return (
    <main className="gate">
      <div className="gate-card">
        <img src="/favicon.svg" alt="" width={72} height={72} />
        <h1>Casa</h1>

        {access.status === 'loading' && <p className="muted">Opening the door…</p>}

        {access.status === 'signed-out' && isSupabaseConfigured && (
          <>
            <p className="muted">Our house, wall by wall.</p>
            <button className="btn btn-primary btn-wide" onClick={signIn}>
              Sign in with Google
            </button>
          </>
        )}

        {access.status === 'signed-out' && !isSupabaseConfigured && (
          <p className="muted">
            Supabase isn't configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and fill it in (see
            the README).
          </p>
        )}

        {access.status === 'denied' && (
          <>
            <p>
              <strong>{access.email}</strong> isn't on the guest list.
            </p>
            <p className="muted">Ask Martin to add it, then sign in again.</p>
            <button className="btn btn-wide" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        )}

        {access.status === 'error' && (
          <>
            <p className="error">Couldn't check access: {access.message}</p>
            <button className="btn btn-wide" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        )}

        {error && <p className="error">{error}</p>}

        {DEMO_AVAILABLE && access.status !== 'loading' && (
          <button className="btn btn-ghost btn-wide" onClick={() => setDemo(true)}>
            Try the demo (saves in this browser only)
          </button>
        )}
      </div>
    </main>
  )
}

import { lazy, Suspense } from 'react'
import { AuthGate, GateCard } from './auth/AuthGate'

// The house (three.js and the whole 3D scene) loads beside the sign-in check instead of before it, so the
// sign-in card shows straight away. A failed early load is tried once more when the house is needed.
const loadHouse = () => import('./House')
const early = loadHouse()
early.catch(() => {})
const House = lazy(() => early.catch(loadHouse).then((m) => ({ default: m.House })))

export const App = () => (
  <AuthGate>
    {(backend, account) => (
      <Suspense
        fallback={
          <GateCard>
            <p className="muted">Opening the door…</p>
          </GateCard>
        }
      >
        <House backend={backend} account={account} />
      </Suspense>
    )}
  </AuthGate>
)

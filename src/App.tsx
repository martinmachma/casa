import { lazy, Suspense, useState, type ComponentProps } from 'react'
import { AuthGate, GateCard } from './auth/AuthGate'

// The house (three.js and the whole 3D scene) loads beside the sign-in check instead of before it, so the
// sign-in card shows straight away. A failed early load is tried once more when the house is needed.
const loadHouse = () => import('./House')
let loaded: Awaited<ReturnType<typeof loadHouse>> | undefined
const early = loadHouse().then((m) => (loaded = m))
early.catch(() => {})
const LazyHouse = lazy(() => early.catch(loadHouse).then((m) => ({ default: m.House })))

// Usually the house is in before anyone is let in, so it renders straight away. lazy() would suspend on it
// once anyway, and React keeps a fallback up for at least 300 ms.
const House = (props: ComponentProps<typeof LazyHouse>) => {
  const [Loaded] = useState(() => loaded?.House)
  return Loaded ? <Loaded {...props} /> : <LazyHouse {...props} />
}

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

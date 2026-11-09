import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

/**
 * True once the house is first fit to be seen: its data is in, nothing (textures, models) is still loading, and the
 * canvas has drawn a frame with all of it, shader builds included. Stays true afterwards.
 */
export const useFirstView = (loading: boolean) => {
  const [ready, setReady] = useState(false)
  const fetching = useProgress((s) => s.active)
  const waiting = !ready && (loading || fetching)
  useEffect(() => {
    if (ready || waiting) return
    // The first rAF is the one the canvas draws in (and builds its shaders in); the second comes after it.
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setReady(true))))
    return () => cancelAnimationFrame(id)
  }, [ready, waiting])
  return ready
}

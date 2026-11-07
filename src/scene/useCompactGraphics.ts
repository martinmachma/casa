import { useSyncExternalStore } from 'react'

// Coarse pointers keep the lighter profile in landscape too; narrow desktop windows use the phone view.
const query = window.matchMedia('(pointer: coarse), (max-width: 820px)')
const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const compact = () => query.matches

/** Phones keep every interaction, with less GPU work spent on decorative detail. */
export const useCompactGraphics = () => useSyncExternalStore(subscribe, compact)

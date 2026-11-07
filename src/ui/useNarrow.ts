import { useSyncExternalStore } from 'react'

/** A phone, or a window as narrow as one. */
export const NARROW = '(max-width: 820px)'
const query = window.matchMedia(NARROW)

export const isNarrow = () => query.matches

const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Whether the window is phone-narrow, kept up to date as it's resized or turned. */
export const useNarrow = () => useSyncExternalStore(subscribe, isNarrow)

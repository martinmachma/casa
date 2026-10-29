import { useSyncExternalStore } from 'react'

const PARAM = 'debug'
const listeners = new Set<() => void>()

const read = () => new URLSearchParams(window.location.search).has(PARAM)

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

/** Debug mode, `?debug` in the URL: labels on every item and device, to point at one when reporting a problem. */
export const useDebug = () => useSyncExternalStore(subscribe, read)

export const setDebug = (on: boolean) => {
  const url = new URL(window.location.href)
  if (on) url.searchParams.set(PARAM, '')
  else url.searchParams.delete(PARAM)
  window.history.replaceState(window.history.state, '', url.toString().replace(`${PARAM}=`, PARAM))
  listeners.forEach((l) => l())
}

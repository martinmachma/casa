import { useCallback, useLayoutEffect, useRef } from 'react'

/** A function that stays the same and calls the latest `fn`, so passing it doesn't re-render a memoised child. */
export const useStable = <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
  const latest = useRef(fn)
  useLayoutEffect(() => {
    latest.current = fn
  })
  return useCallback((...args: Args) => latest.current(...args), [])
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WallSide } from '../layout/types'
import type { Backend, FurnitureItem, NewFurnitureItem } from './types'
import { wallColorKey } from './types'

// The colour picker fires continuously while dragged; save only once it settles.
const WALL_SAVE_DELAY_MS = 400

/** Wall colours and furniture, updated optimistically and saved through the backend. */
export const useHouseData = (backend: Backend) => {
  const [wallColors, setWallColors] = useState<Map<string, string>>(new Map())
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const wallSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([backend.loadWallColors(), backend.loadFurniture()])
      .then(([colors, items]) => {
        if (cancelled) return
        setWallColors(new Map(colors.map((c) => [wallColorKey(c.wallId, c.side), c.color])))
        setFurniture(items)
      })
      .catch(fail)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [backend, fail])

  const setWallColor = useCallback(
    (wallId: string, side: WallSide, color: string | undefined) => {
      setWallColors((prev) => {
        const next = new Map(prev)
        if (color) next.set(wallColorKey(wallId, side), color)
        else next.delete(wallColorKey(wallId, side))
        return next
      })
      const key = wallColorKey(wallId, side)
      const timers = wallSaveTimers.current
      clearTimeout(timers.get(key))
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key)
          const saved = color ? backend.saveWallColor({ wallId, side, color }) : backend.clearWallColor(wallId, side)
          saved.catch(fail)
        }, WALL_SAVE_DELAY_MS),
      )
    },
    [backend, fail],
  )

  const addFurniture = useCallback(
    async (item: NewFurnitureItem) => {
      try {
        const created = await backend.insertFurniture(item)
        setFurniture((prev) => [...prev, created])
        return created
      } catch (e) {
        fail(e)
        return undefined
      }
    },
    [backend, fail],
  )

  /** Changes the item on screen only; call `saveFurniture` once the gesture or edit is finished. */
  const patchFurniture = useCallback((id: string, patch: Partial<FurnitureItem>) => {
    setFurniture((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }, [])

  const saveFurniture = useCallback(
    (item: FurnitureItem) => {
      backend.updateFurniture(item).catch(fail)
    },
    [backend, fail],
  )

  const removeFurniture = useCallback(
    (id: string) => {
      setFurniture((prev) => prev.filter((f) => f.id !== id))
      backend.deleteFurniture(id).catch(fail)
    },
    [backend, fail],
  )

  return {
    loading,
    error,
    clearError: () => setError(undefined),
    wallColors,
    setWallColor,
    furniture,
    addFurniture,
    patchFurniture,
    saveFurniture,
    removeFurniture,
  }
}

export type HouseData = ReturnType<typeof useHouseData>

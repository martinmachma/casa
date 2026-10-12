import { useCallback, useEffect, useRef, useState } from 'react'
import type { WallSide } from '../layout/types'
import type { Backend, FurnitureItem, NewFurnitureItem, RemoteChange } from './types'
import { wallColorKey } from './types'

// The colour picker fires continuously while dragged; save only once it settles.
const WALL_SAVE_DELAY_MS = 400
// After a local save lands, its own echo (and older changes) can still arrive from the server; ignore them
// for a moment so the screen doesn't jump back.
const ECHO_GRACE_MS = 1500

/**
 * Keys (furniture ids, wall keys) being edited on this device. Remote changes to them are ignored until the
 * edit is saved and has had time to echo back.
 */
class LocalEdits {
  private until = new Map<string, number>()
  begin(key: string) {
    this.until.set(key, Infinity)
  }
  settle(key: string) {
    this.until.set(key, Date.now() + ECHO_GRACE_MS)
  }
  active(key: string) {
    return (this.until.get(key) ?? 0) > Date.now()
  }
}

/** Wall colours and furniture, updated optimistically, saved through the backend and kept in sync live. */
export const useHouseData = (backend: Backend) => {
  const [wallColors, setWallColors] = useState<Map<string, string>>(new Map())
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const wallSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const furnitureSaves = useRef(new Map<string, number>())
  const [edits] = useState(() => new LocalEdits())

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), [])

  useEffect(() => {
    let cancelled = false

    // Replaces everything with the saved state, except what is being edited here right now.
    const load = () =>
      Promise.all([backend.loadWallColors(), backend.loadFurniture()])
        .then(([colors, items]) => {
          if (cancelled) return
          setWallColors((prev) => {
            const next = new Map(colors.map((c) => [wallColorKey(c.wallId, c.side), c.color]))
            for (const key of [...next.keys()]) if (edits.active(key) && !prev.has(key)) next.delete(key)
            for (const [key, color] of prev) if (edits.active(key)) next.set(key, color)
            return next
          })
          setFurniture((prev) => {
            const mine = new Map(prev.filter((f) => edits.active(f.id)).map((f) => [f.id, f]))
            return items.map((f) => mine.get(f.id) ?? f)
          })
        })
        .catch(fail)
        .finally(() => !cancelled && setLoading(false))

    const apply = (change: RemoteChange) => {
      if (change.kind === 'wall') {
        const key = wallColorKey(change.wallId, change.side)
        if (edits.active(key)) return
        setWallColors((prev) => {
          if (prev.get(key) === change.color) return prev
          const next = new Map(prev)
          if (change.color) next.set(key, change.color)
          else next.delete(key)
          return next
        })
      } else if (change.kind === 'furniture') {
        const { item } = change
        if (edits.active(item.id)) return
        setFurniture((prev) =>
          prev.some((f) => f.id === item.id) ? prev.map((f) => (f.id === item.id ? item : f)) : [...prev, item],
        )
      } else {
        setFurniture((prev) => prev.filter((f) => f.id !== change.id))
      }
    }

    load()
    const unsubscribe = backend.subscribe(apply, load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [backend, fail, edits])

  const setWallColor = useCallback(
    (wallId: string, side: WallSide, color: string | undefined) => {
      setWallColors((prev) => {
        const next = new Map(prev)
        if (color) next.set(wallColorKey(wallId, side), color)
        else next.delete(wallColorKey(wallId, side))
        return next
      })
      const key = wallColorKey(wallId, side)
      edits.begin(key)
      const timers = wallSaveTimers.current
      clearTimeout(timers.get(key))
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key)
          const saved = color ? backend.saveWallColor({ wallId, side, color }) : backend.clearWallColor(wallId, side)
          saved.catch(fail).finally(() => !timers.has(key) && edits.settle(key))
        }, WALL_SAVE_DELAY_MS),
      )
    },
    [backend, fail, edits],
  )

  const addFurniture = useCallback(
    async (item: NewFurnitureItem) => {
      try {
        const created = await backend.insertFurniture(item)
        // The insert's echo may have arrived first.
        setFurniture((prev) => (prev.some((f) => f.id === created.id) ? prev : [...prev, created]))
        return created
      } catch (e) {
        fail(e)
        return undefined
      }
    },
    [backend, fail],
  )

  /** Changes the item on screen only; call `saveFurniture` once the gesture or edit is finished. */
  const patchFurniture = useCallback(
    (id: string, patch: Partial<FurnitureItem>) => {
      edits.begin(id)
      setFurniture((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
    },
    [edits],
  )

  const saveFurniture = useCallback(
    (item: FurnitureItem) => {
      const inFlight = furnitureSaves.current
      edits.begin(item.id)
      inFlight.set(item.id, (inFlight.get(item.id) ?? 0) + 1)
      backend
        .updateFurniture(item)
        .catch(fail)
        .finally(() => {
          const left = (inFlight.get(item.id) ?? 1) - 1
          if (left > 0) return void inFlight.set(item.id, left)
          inFlight.delete(item.id)
          edits.settle(item.id)
        })
    },
    [backend, fail, edits],
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WallSide } from '../layout/types'
import type { Backend, FurnitureItem, HouseState, NewFurnitureItem, Version } from './types'
import { EMPTY_STATE, wallColorKey } from './types'

/** What is being looked at: whichever version is live, the bare house, or one version by id. */
export type Viewing = typeof LIVE | typeof BARE | string
export const LIVE = 'live'
export const BARE = 'bare'

/** Edits not yet saved as a version, on top of the version they started from (none: the bare house). */
type Draft = { basedOn: string | undefined; state: HouseState }

/**
 * Undo history: drafts before (`past`) and after (`future`) the current one; `undefined` is "no edits". Consecutive
 * edits with the same key (one drag, one colour being picked) collapse into one step.
 */
type History = { draft: Draft | undefined; past: (Draft | undefined)[]; future: (Draft | undefined)[]; key?: string }

const HISTORY_LIMIT = 100

const draftKey = (backend: Backend) => `casa.draft.${backend.kind}`

// Unsaved edits survive a reload, on this device only.
const readDraft = (backend: Backend): Draft | undefined => {
  try {
    const raw = localStorage.getItem(draftKey(backend))
    return raw ? (JSON.parse(raw) as Draft) : undefined
  } catch {
    return undefined
  }
}

const writeDraft = (backend: Backend, draft: Draft | undefined) => {
  try {
    if (draft) localStorage.setItem(draftKey(backend), JSON.stringify(draft))
    else localStorage.removeItem(draftKey(backend))
  } catch {
    // Private mode or full storage: unsaved edits are just lost on reload.
  }
}

/**
 * The house's versions and the one on screen. Edits go into an unsaved draft on this device; saving it makes a new
 * version, which anyone can then make live.
 */
export const useHouseData = (backend: Backend) => {
  const [versions, setVersions] = useState<Version[]>([])
  const [liveId, setLiveId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [viewing, setViewing] = useState<Viewing>(LIVE)
  const [history, setHistory] = useState<History>(() => ({ draft: readDraft(backend), past: [], future: [] }))
  const { draft } = history

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), [])

  const reload = useCallback(
    () =>
      backend
        .loadVersions()
        .then((r) => {
          setVersions(r.versions)
          setLiveId(r.liveId)
        })
        .catch(fail)
        .finally(() => setLoading(false)),
    [backend, fail],
  )

  useEffect(() => backend.subscribe(reload), [backend, reload])
  useEffect(() => void reload(), [reload])

  useEffect(() => {
    const t = setTimeout(() => writeDraft(backend, draft), 300)
    return () => clearTimeout(t)
  }, [backend, draft])

  // A version deleted elsewhere falls back to the live one.
  const viewedId =
    viewing === LIVE ? liveId : viewing === BARE ? undefined : versions.some((v) => v.id === viewing) ? viewing : liveId
  const viewed = versions.find((v) => v.id === viewedId)
  const state = draft?.state ?? viewed?.data ?? EMPTY_STATE

  const wallColors = useMemo(
    () => new Map(state.walls.map((w) => [wallColorKey(w.wallId, w.side), w.color])),
    [state.walls],
  )
  const roomNames = useMemo(() => new Map((state.rooms ?? []).map((r) => [r.roomId, r.name])), [state.rooms])
  const roomFloors = useMemo(() => new Map(state.floors.map((f) => [f.roomId, f.material])), [state.floors])

  /** Applies an edit, starting a draft from what's on screen if there isn't one. */
  const edit = (change: (s: HouseState) => HouseState, key?: string) =>
    setHistory((h) => {
      const d = h.draft
      const next = { basedOn: d ? d.basedOn : viewedId, state: change(d?.state ?? state) }
      const merge = key !== undefined && key === h.key
      return { draft: next, past: merge ? h.past : [...h.past, d].slice(-HISTORY_LIMIT), future: [], key }
    })

  /** Starts over with no edits and no history. */
  const clearDraft = () => setHistory({ draft: undefined, past: [], future: [] })

  /** Ends a run of keyed edits, so the next one (say, another drag of the same item) is its own undo step. */
  const endEdit = () => setHistory((h) => (h.key === undefined ? h : { ...h, key: undefined }))

  const undo = () =>
    setHistory((h) =>
      h.past.length
        ? { draft: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.draft, ...h.future] }
        : h,
    )

  const redo = () =>
    setHistory((h) =>
      h.future.length ? { draft: h.future[0], past: [...h.past, h.draft], future: h.future.slice(1) } : h,
    )

  const setWallColor = (wallId: string, side: WallSide, color: string | undefined) =>
    edit(
      (s) => ({
        ...s,
        walls: [
          ...s.walls.filter((w) => !(w.wallId === wallId && w.side === side)),
          ...(color ? [{ wallId, side, color }] : []),
        ],
      }),
      `wall:${wallId}:${side}`,
    )

  const setRoomFloor = (roomId: string, material: string | undefined) =>
    edit((s) => ({
      ...s,
      floors: [...s.floors.filter((f) => f.roomId !== roomId), ...(material ? [{ roomId, material }] : [])],
    }))

  /** Renames a room; an empty name goes back to the plan's. */
  const setRoomName = (roomId: string, name: string) =>
    edit(
      (s) => ({
        ...s,
        rooms: [...(s.rooms ?? []).filter((r) => r.roomId !== roomId), ...(name.trim() ? [{ roomId, name }] : [])],
      }),
      `room:${roomId}`,
    )

  const addFurniture = (item: NewFurnitureItem): FurnitureItem => {
    const created = { ...item, id: crypto.randomUUID() }
    edit((s) => ({ ...s, furniture: [...s.furniture, created] }))
    return created
  }

  /** Changes an item; changes with the same `key` (one drag, one colour being picked) undo as one step. */
  const patchFurniture = (id: string, patch: Partial<FurnitureItem>, key?: string) =>
    edit((s) => ({ ...s, furniture: s.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)) }), key)

  const removeFurniture = (id: string) => edit((s) => ({ ...s, furniture: s.furniture.filter((f) => f.id !== id) }))

  /** Saves the draft as a new version and shows it; optionally makes it live straight away. */
  const saveDraft = async (name: string, makeLive: boolean) => {
    if (!draft) return
    try {
      const created = await backend.saveVersion(name, draft.state, draft.basedOn)
      if (makeLive) await backend.setLive(created.id)
      clearDraft()
      writeDraft(backend, undefined)
      setViewing(makeLive ? LIVE : created.id)
      await reload()
    } catch (e) {
      fail(e)
    }
  }

  const discardDraft = () => {
    clearDraft()
    writeDraft(backend, undefined)
  }

  const run = (action: Promise<void>) => action.then(reload).catch(fail)

  return {
    loading,
    error,
    clearError: () => setError(undefined),
    versions,
    liveId,
    viewing,
    /** The version on screen (under the draft, if any); undefined for the bare house. */
    viewed,
    view: setViewing,
    /** Whether there are edits not yet saved as a version. */
    dirty: draft !== undefined,
    saveDraft,
    discardDraft,
    endEdit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    makeLive: (id: string | undefined) => run(backend.setLive(id)),
    deleteVersion: (id: string) => run(backend.deleteVersion(id)),
    wallColors,
    setWallColor,
    roomFloors,
    setRoomFloor,
    roomNames,
    setRoomName,
    furniture: state.furniture,
    addFurniture,
    patchFurniture,
    removeFurniture,
  }
}

export type HouseData = ReturnType<typeof useHouseData>

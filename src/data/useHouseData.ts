import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WallFace } from '../layout/types'
import type { Backend, Device, FurnitureItem, HouseState, NewDevice, NewFurnitureItem, Version } from './types'
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

const NO_DEVICES: Device[] = []
const NO_VERSIONS: Version[] = []

/** Deep equality of plain JSON data, whatever order object keys come in (the database stores them sorted). */
export const sameJson = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  return (
    ka.length === kb.length &&
    ka.every((k) => sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  )
}

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
export const useHouseData = (backend: Backend, liveOnly = false) => {
  const client = useQueryClient()
  const queryKey = useMemo(() => ['versions', backend.kind], [backend.kind])
  const query = useQuery({ queryKey, queryFn: backend.loadVersions })
  const versions = query.data?.versions ?? NO_VERSIONS
  const liveId = query.data?.liveId
  const [failed, setError] = useState<string>()
  const error = failed ?? query.error?.message
  const [viewing, setViewing] = useState<Viewing>(LIVE)
  // Edits kept from an earlier visit lose their steps, but one undo still takes them back to the saved version.
  const [history, setHistory] = useState<History>(() => {
    const draft = readDraft(backend)
    return { draft, past: draft ? [undefined] : [], future: [] }
  })
  const { draft } = history

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), [])

  const reload = useCallback(() => client.invalidateQueries({ queryKey }), [client, queryKey])

  useEffect(() => backend.subscribe(() => void reload()), [backend, reload])

  // A change to the versions, after which they're loaded again.
  const change = useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onSuccess: reload,
    onError: fail,
  })

  useEffect(() => {
    const t = setTimeout(() => writeDraft(backend, draft), 300)
    return () => clearTimeout(t)
  }, [backend, draft])

  // Edits that end up back where the version was (moved there and back, say) leave nothing to save.
  const dirty = useMemo(() => {
    if (!draft) return false
    const base = versions.find((v) => v.id === draft.basedOn)?.data ?? EMPTY_STATE
    return !sameJson(draft.state, base)
  }, [draft, versions])

  // Ask before leaving with edits that aren't saved as a version. Away from planning the draft is out of sight
  // (and it's kept on this device anyway), so leaving is quiet.
  const warnOnLeave = dirty && !liveOnly
  useEffect(() => {
    if (!warnOnLeave) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [warnOnLeave])

  // A version deleted elsewhere falls back to the live one.
  // At home only the saved live version shows; the draft waits for planning.
  const viewedId =
    liveOnly || viewing === LIVE
      ? liveId
      : viewing === BARE
        ? undefined
        : versions.some((v) => v.id === viewing)
          ? viewing
          : liveId
  const viewed = versions.find((v) => v.id === viewedId)
  const state = (liveOnly ? undefined : draft?.state) ?? viewed?.data ?? EMPTY_STATE

  const wallColors = useMemo(
    () => new Map(state.walls.map((w) => [wallColorKey(w.wallId, w.side, w.part), w.color])),
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

  const setWallColor = (wallId: string, side: WallFace, part: number, color: string | undefined) =>
    edit((s) => {
      const sideColor = s.walls.find((w) => w.wallId === wallId && w.side === side && w.part === undefined)
      return {
        ...s,
        walls: [
          ...s.walls.filter((w) => !(w.wallId === wallId && w.side === side && w.part === part)),
          // A reset part goes back to the whole side's paint; with none, to the default.
          ...(color && color !== sideColor?.color ? [{ wallId, side, part, color }] : []),
        ],
      }
    }, `wall:${wallId}:${side}:${part}`)

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

  /** Adds pieces as one undo step. */
  const addFurniture = (...items: NewFurnitureItem[]): FurnitureItem[] => {
    const created = items.map((item) => ({ ...item, id: crypto.randomUUID() }))
    edit((s) => ({ ...s, furniture: [...s.furniture, ...created] }))
    return created
  }

  /** Changes an item; changes with the same `key` (one drag, one colour being picked) undo as one step. */
  const patchFurniture = (id: string, patch: Partial<FurnitureItem>, key?: string) =>
    patchFurnitures(new Map([[id, patch]]), key)

  /** Changes several items at once (a group being dragged or turned), as one undo step. */
  const patchFurnitures = (patches: Map<string, Partial<FurnitureItem>>, key?: string) =>
    edit(
      (s) => ({ ...s, furniture: s.furniture.map((f) => (patches.has(f.id) ? { ...f, ...patches.get(f.id) } : f)) }),
      key,
    )

  const removeFurniture = (...ids: string[]) =>
    edit((s) => ({ ...s, furniture: s.furniture.filter((f) => !ids.includes(f.id)) }))

  const addDevice = (device: NewDevice): Device => {
    const created = { ...device, id: crypto.randomUUID() }
    edit((s) => ({ ...s, devices: [...(s.devices ?? []), created] }))
    return created
  }

  /** Changes a device; changes with the same `key` (one drag) undo as one step. */
  const patchDevice = (id: string, patch: Partial<Device>, key?: string) =>
    edit((s) => ({ ...s, devices: (s.devices ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d)) }), key)

  const removeDevice = (id: string) => edit((s) => ({ ...s, devices: (s.devices ?? []).filter((d) => d.id !== id) }))

  const save = useMutation({
    mutationFn: async ({ name, makeLive, draft }: { name: string; makeLive: boolean; draft: Draft }) => {
      const created = await backend.saveVersion(name, draft.state, draft.basedOn)
      if (makeLive) await backend.setLive(created.id)
      // The new version is loaded before the draft goes, so the old one never shows in between.
      await reload()
      return created
    },
    onSuccess: (created, { makeLive }) => {
      clearDraft()
      writeDraft(backend, undefined)
      setViewing(makeLive ? LIVE : created.id)
    },
    onError: fail,
  })

  /** Saves the draft as a new version and shows it; optionally makes it live straight away. */
  const saveDraft = async (name: string, makeLive: boolean) => {
    if (draft) await save.mutateAsync({ name, makeLive, draft }).catch(() => {})
  }

  const discardDraft = () => {
    clearDraft()
    writeDraft(backend, undefined)
  }

  return {
    loading: query.isPending,
    error,
    clearError: () => {
      setError(undefined)
      if (query.isError) void query.refetch()
    },
    versions,
    liveId,
    viewing,
    /** The version on screen (under the draft, if any); undefined for the bare house. */
    viewed,
    view: setViewing,
    /** Whether there are edits not yet saved as a version. */
    dirty,
    saveDraft,
    discardDraft,
    endEdit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    makeLive: (id: string | undefined) => change.mutate(() => backend.setLive(id)),
    renameVersion: (id: string, name: string) => change.mutate(() => backend.renameVersion(id, name)),
    deleteVersion: (id: string) => change.mutate(() => backend.deleteVersion(id)),
    wallColors,
    setWallColor,
    roomFloors,
    setRoomFloor,
    roomNames,
    setRoomName,
    furniture: state.furniture,
    addFurniture,
    patchFurniture,
    patchFurnitures,
    removeFurniture,
    // Versions and drafts from before devices have none.
    devices: state.devices ?? NO_DEVICES,
    addDevice,
    patchDevice,
    removeDevice,
  }
}

export type HouseData = ReturnType<typeof useHouseData>

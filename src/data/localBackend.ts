import type { Backend, FurnitureItem, RemoteChange, RoomFloor, WallColor } from './types'
import { wallColorKey } from './types'

// The demo keeps everything in this browser's localStorage.
const WALLS_KEY = 'casa.demo.walls'
const FURNITURE_KEY = 'casa.demo.furniture'
const FLOORS_KEY = 'casa.demo.floors'

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: the demo just forgets on reload.
  }
}

// Other tabs of the demo hear about changes through a BroadcastChannel (it never echoes to the sender).
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('casa.demo')
const announce = (change: RemoteChange) => channel?.postMessage(change)

const walls = () => read<WallColor[]>(WALLS_KEY, [])
const roomFloors = () => read<RoomFloor[]>(FLOORS_KEY, [])
const furniture = () => read<FurnitureItem[]>(FURNITURE_KEY, [])

export const localBackend: Backend = {
  kind: 'local',

  loadWallColors: async () => walls(),

  saveWallColor: async (c) => {
    const key = wallColorKey(c.wallId, c.side)
    write(WALLS_KEY, [...walls().filter((w) => wallColorKey(w.wallId, w.side) !== key), c])
    announce({ kind: 'wall', ...c })
  },

  clearWallColor: async (wallId, side) => {
    write(
      WALLS_KEY,
      walls().filter((w) => !(w.wallId === wallId && w.side === side)),
    )
    announce({ kind: 'wall', wallId, side, color: undefined })
  },

  loadRoomFloors: async () => roomFloors(),

  saveRoomFloor: async (f) => {
    write(FLOORS_KEY, [...roomFloors().filter((r) => r.roomId !== f.roomId), f])
    announce({ kind: 'room-floor', ...f })
  },

  clearRoomFloor: async (roomId) => {
    write(
      FLOORS_KEY,
      roomFloors().filter((r) => r.roomId !== roomId),
    )
    announce({ kind: 'room-floor', roomId, material: undefined })
  },

  loadFurniture: async () => furniture(),

  insertFurniture: async (item) => {
    const created = { ...item, id: crypto.randomUUID() }
    write(FURNITURE_KEY, [...furniture(), created])
    announce({ kind: 'furniture', item: created })
    return created
  },

  updateFurniture: async (item) => {
    write(
      FURNITURE_KEY,
      furniture().map((f) => (f.id === item.id ? item : f)),
    )
    announce({ kind: 'furniture', item })
  },

  deleteFurniture: async (id) => {
    write(
      FURNITURE_KEY,
      furniture().filter((f) => f.id !== id),
    )
    announce({ kind: 'furniture-deleted', id })
  },

  subscribe: (onChange) => {
    if (!channel) return () => {}
    const listener = (e: MessageEvent<RemoteChange>) => onChange(e.data)
    channel.addEventListener('message', listener)
    return () => channel.removeEventListener('message', listener)
  },
}

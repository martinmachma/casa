import type { Backend, FurnitureItem, WallColor } from './types'
import { wallColorKey } from './types'

// The demo keeps everything in this browser's localStorage.
const WALLS_KEY = 'casa.demo.walls'
const FURNITURE_KEY = 'casa.demo.furniture'

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

const walls = () => read<WallColor[]>(WALLS_KEY, [])
const furniture = () => read<FurnitureItem[]>(FURNITURE_KEY, [])

export const localBackend: Backend = {
  kind: 'local',

  loadWallColors: async () => walls(),

  saveWallColor: async (c) => {
    const key = wallColorKey(c.wallId, c.side)
    write(WALLS_KEY, [...walls().filter((w) => wallColorKey(w.wallId, w.side) !== key), c])
  },

  clearWallColor: async (wallId, side) => {
    write(
      WALLS_KEY,
      walls().filter((w) => !(w.wallId === wallId && w.side === side)),
    )
  },

  loadFurniture: async () => furniture(),

  insertFurniture: async (item) => {
    const created = { ...item, id: crypto.randomUUID() }
    write(FURNITURE_KEY, [...furniture(), created])
    return created
  },

  updateFurniture: async (item) => {
    write(
      FURNITURE_KEY,
      furniture().map((f) => (f.id === item.id ? item : f)),
    )
  },

  deleteFurniture: async (id) => {
    write(
      FURNITURE_KEY,
      furniture().filter((f) => f.id !== id),
    )
  },
}

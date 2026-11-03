import type { RoomOrder } from '../rooms/roomOrder'
import type { Backend, Version } from './types'

// The demo keeps everything in this browser's localStorage.
const VERSIONS_KEY = 'casa.demo.versions'
const LIVE_KEY = 'casa.demo.live'

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
    if (value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: the demo just forgets on reload.
  }
}

// Other tabs of the demo hear about changes through a BroadcastChannel (it never echoes to the sender).
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('casa.demo')
const announce = () => channel?.postMessage('changed')

let demoRoomOrder: RoomOrder | undefined

const versions = () => read<Version[]>(VERSIONS_KEY, [])

/** The live version's id; one that was deleted leaves the bare house live. */
const liveId = () => {
  const live = read<string | undefined>(LIVE_KEY, undefined)
  return versions().some((v) => v.id === live) ? live : undefined
}

export const localBackend: Backend = {
  kind: 'local',

  loadVersions: async () => ({ versions: versions(), liveId: liveId() }),

  saveVersion: async (name, data, basedOn) => {
    const created: Version = {
      id: crypto.randomUUID(),
      name,
      author: 'demo',
      createdAt: new Date().toISOString(),
      ...(basedOn ? { basedOn } : {}),
      data,
    }
    write(VERSIONS_KEY, [created, ...versions()])
    announce()
    return created
  },

  renameVersion: async (id, name) => {
    write(
      VERSIONS_KEY,
      versions().map((v) => (v.id === id ? { ...v, name } : v)),
    )
    announce()
  },

  deleteVersion: async (id) => {
    write(
      VERSIONS_KEY,
      versions().filter((v) => v.id !== id),
    )
    if (read<string | undefined>(LIVE_KEY, undefined) === id) write(LIVE_KEY, undefined)
    announce()
  },

  setLive: async (id) => {
    write(LIVE_KEY, id)
    announce()
  },

  replaceLive: async (id, current) => {
    if (liveId() !== current) return false
    write(LIVE_KEY, id)
    announce()
    return true
  },

  // The demo has no one signed in, so the room order lasts until the page is reloaded.
  loadRoomOrder: async () => demoRoomOrder,
  saveRoomOrder: async (order) => {
    demoRoomOrder = order
  },

  subscribe: (onChange) => {
    if (!channel) return () => {}
    channel.addEventListener('message', onChange)
    return () => channel.removeEventListener('message', onChange)
  },
}

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

const versions = () => read<Version[]>(VERSIONS_KEY, [])

export const localBackend: Backend = {
  kind: 'local',

  loadVersions: async () => {
    const all = versions()
    const live = read<string | undefined>(LIVE_KEY, undefined)
    return { versions: all, liveId: all.some((v) => v.id === live) ? live : undefined }
  },

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

  subscribe: (onChange) => {
    if (!channel) return () => {}
    channel.addEventListener('message', onChange)
    return () => channel.removeEventListener('message', onChange)
  },
}

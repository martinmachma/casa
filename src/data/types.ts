import type { RoomOrder } from '../rooms/roomOrder'
import type { WallFace, WallSide } from '../layout/types'

/**
 * A side's paint; with `part`, just that part of it (see wallJoints), over the whole side's. An end's `part` is
 * where it is along the wall, in millimetres.
 */
export type WallColor = { wallId: string; side: WallFace; part?: number; color: string }

/**
 * Paint over a rectangle of one part of a wall side (a dado, a stripe, a patch behind the bed), on top of the
 * part's own. Metres: `u0`–`u1` along the wall from its `from` point, `y0`–`y1` above the floor. On an end,
 * `u0`–`u1` run across it, from the centre line of the wall the end is on, towards side a. On a sill or head,
 * `u0`–`u1` run along the wall as on a side, and `y0`–`y1` across it from side b's face.
 */
export type WallArea = {
  id: string
  wallId: string
  side: WallFace
  part: number
  u0: number
  u1: number
  y0: number
  y1: number
  color: string
}

export type NewWallArea = Omit<WallArea, 'id'>

export type FurnitureItem = {
  id: string
  /** Layout floor id. */
  floor: string
  name: string
  /** Metres. Width runs along the item's own x axis, depth across it. */
  width: number
  depth: number
  height: number
  /** Plan position of the centre, metres. */
  x: number
  y: number
  /** Plan angle, radians. */
  rotation: number
  /** Height of its underside above the floor, metres: a shelf or cabinet hung on a wall. Absent: on the floor. */
  z?: number
  /** Box colour, or the fabric colour of a model. */
  color: string
  /** Catalog model (furniture/catalog.ts); a plain box when absent. */
  model?: string
}

/** A name given to a room, replacing the plan's; the plan number stays. */
export type RoomName = { roomId: string; name: string }

export type NewFurnitureItem = Omit<FurnitureItem, 'id'>

export type DeviceKind =
  | 'light'
  | 'switch'
  | 'socket'
  | 'sensor'
  | 'thermostat'
  | 'blind'
  | 'data'
  | 'tv'
  | 'connection'
  | 'panel'
  | 'fan'
  | 'bell'
  | 'earth'
  | 'other'

/** A smart-home device placed in the house. */
export type Device = {
  id: string
  /** Layout floor id. */
  floor: string
  kind: DeviceKind
  name: string
  /** Plan position, metres; on the wall face for wall-mounted devices. */
  x: number
  y: number
  /** Height above the floor, metres (a socket 0.3, a switch 1.1, a ceiling light the floor's wall height). */
  z: number
  /** Set for wall-mounted devices: which wall and face it sits on. Ceiling devices leave it out. */
  wall?: { wallId: string; side: WallSide }
  /** Home Assistant entity id, e.g. light.living_ceiling. */
  entity?: string
  /** Fixed infrastructure traced from the electrical drawings, independent of saved furnishing versions. */
  plan?: {
    sheet: 2 | 3 | 4
    symbol: string
    notes?: string
    ports?: number
    area: 'inside' | 'outside' | 'roof'
  }
}

export type NewDevice = Omit<Device, 'id'>

/** Everything placed in the house: what a version records. */
export type HouseState = {
  /** Built-in fittings whose older catalog equivalents have already been retired from this state. */
  builtInFixtures?: string[]
  walls: WallColor[]
  /** Absent in versions saved before parts of walls could be painted. */
  wallAreas?: WallArea[]
  furniture: FurnitureItem[]
  /** Absent in versions saved before rooms could be renamed. */
  rooms?: RoomName[]
  /** Absent in versions saved before devices could be placed. */
  devices?: Device[]
}

export const EMPTY_STATE: HouseState = { walls: [], wallAreas: [], furniture: [], rooms: [], devices: [] }

/** A saved snapshot of the house; once saved only its name can change. */
export type Version = {
  id: string
  name: string
  /** Email of whoever saved it. */
  author?: string
  createdAt: string
  /** The version it was edited from; absent when started from the bare house. */
  basedOn?: string
  data: HouseState
}

/** Where versions are saved: Supabase for real use, the browser for the demo. */
export type Backend = {
  kind: 'supabase' | 'local'
  /** Newest first, with the live version's id (none: the bare house is live). */
  loadVersions: () => Promise<{ versions: Version[]; liveId: string | undefined }>
  saveVersion: (name: string, data: HouseState, basedOn: string | undefined) => Promise<Version>
  renameVersion: (id: string, name: string) => Promise<void>
  deleteVersion: (id: string) => Promise<void>
  setLive: (id: string | undefined) => Promise<void>
  /** Makes `id` live only while `current` still is; false when another one was made live in the meantime. */
  replaceLive: (id: string | undefined, current: string | undefined) => Promise<boolean>
  /** The signed-in person's order of the room menu; undefined until they first arrange it. */
  loadRoomOrder: () => Promise<RoomOrder | undefined>
  saveRoomOrder: (order: RoomOrder) => Promise<void>
  /** Calls `onChange` whenever versions or the live one may have changed elsewhere. Returns the unsubscribe. */
  subscribe: (onChange: () => void) => () => void
}

export const wallColorKey = (wallId: string, side: WallFace, part?: number) =>
  part === undefined ? `${wallId}:${side}` : `${wallId}:${side}:${part}`

/** The paint on one part of a wall side: its own, else the whole side's. */
export const wallPartColor = (colors: Map<string, string>, wallId: string, side: WallFace, part: number) =>
  colors.get(wallColorKey(wallId, side, part)) ?? colors.get(wallColorKey(wallId, side))

import type { WallFace, WallSide } from '../layout/types'

/**
 * A side's paint; with `part`, just that part of it (see wallJoints), over the whole side's. An end's `part` is
 * where it is along the wall, in millimetres.
 */
export type WallColor = { wallId: string; side: WallFace; part?: number; color: string }

/** A room's floor finish; `material` is an id from scene/floorMaterials. */
export type RoomFloor = { roomId: string; material: string }

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

export type DeviceKind = 'light' | 'switch' | 'socket' | 'sensor' | 'thermostat' | 'blind' | 'other'

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
}

export type NewDevice = Omit<Device, 'id'>

/** Everything placed in the house: what a version records. */
export type HouseState = {
  walls: WallColor[]
  floors: RoomFloor[]
  furniture: FurnitureItem[]
  /** Absent in versions saved before rooms could be renamed. */
  rooms?: RoomName[]
  /** Absent in versions saved before devices could be placed. */
  devices?: Device[]
}

export const EMPTY_STATE: HouseState = { walls: [], floors: [], furniture: [], rooms: [], devices: [] }

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
  /** Calls `onChange` whenever versions or the live one may have changed elsewhere. Returns the unsubscribe. */
  subscribe: (onChange: () => void) => () => void
}

export const wallColorKey = (wallId: string, side: WallFace, part?: number) =>
  part === undefined ? `${wallId}:${side}` : `${wallId}:${side}:${part}`

/** The paint on one part of a wall side: its own, else the whole side's. */
export const wallPartColor = (colors: Map<string, string>, wallId: string, side: WallFace, part: number) =>
  colors.get(wallColorKey(wallId, side, part)) ?? colors.get(wallColorKey(wallId, side))

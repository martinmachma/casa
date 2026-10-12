import type { WallSide } from '../layout/types'

export type WallColor = { wallId: string; side: WallSide; color: string }

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
  color: string
}

export type NewFurnitureItem = Omit<FurnitureItem, 'id'>

/** A change made on another device (or another tab in the demo). */
export type RemoteChange =
  | { kind: 'wall'; wallId: string; side: WallSide; color: string | undefined }
  | { kind: 'furniture'; item: FurnitureItem }
  | { kind: 'furniture-deleted'; id: string }
  | { kind: 'room-floor'; roomId: string; material: string | undefined }

/** Where the house state is saved: Supabase for real use, the browser for the demo. */
export type Backend = {
  kind: 'supabase' | 'local'
  loadWallColors: () => Promise<WallColor[]>
  saveWallColor: (c: WallColor) => Promise<void>
  clearWallColor: (wallId: string, side: WallSide) => Promise<void>
  loadRoomFloors: () => Promise<RoomFloor[]>
  saveRoomFloor: (f: RoomFloor) => Promise<void>
  clearRoomFloor: (roomId: string) => Promise<void>
  loadFurniture: () => Promise<FurnitureItem[]>
  insertFurniture: (item: NewFurnitureItem) => Promise<FurnitureItem>
  updateFurniture: (item: FurnitureItem) => Promise<void>
  deleteFurniture: (id: string) => Promise<void>
  /**
   * Calls `onChange` for every change saved elsewhere, and `onResync` when the connection was (re)established and
   * changes may have been missed. Returns the unsubscribe function.
   */
  subscribe: (onChange: (change: RemoteChange) => void, onResync: () => void) => () => void
}

/** Keys in the data hook's map of local edits; furniture uses its id. */
export const roomFloorKey = (roomId: string) => `floor:${roomId}`

export const wallColorKey = (wallId: string, side: WallSide) => `${wallId}:${side}`

import type { WallSide } from '../layout/types'

export type WallColor = { wallId: string; side: WallSide; color: string }

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

/** Where the house state is saved: Supabase for real use, the browser for the demo. */
export type Backend = {
  kind: 'supabase' | 'local'
  loadWallColors: () => Promise<WallColor[]>
  saveWallColor: (c: WallColor) => Promise<void>
  clearWallColor: (wallId: string, side: WallSide) => Promise<void>
  loadFurniture: () => Promise<FurnitureItem[]>
  insertFurniture: (item: NewFurnitureItem) => Promise<FurnitureItem>
  updateFurniture: (item: FurnitureItem) => Promise<void>
  deleteFurniture: (id: string) => Promise<void>
}

export const wallColorKey = (wallId: string, side: WallSide) => `${wallId}:${side}`

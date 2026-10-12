// Plan coordinates are metres: x grows east, y grows south. 3D maps plan (x, y) to (x, z).
export type Point = [x: number, y: number]

export type Opening = {
  type: 'door' | 'window'
  /** Distance from the wall's `from` point to the opening's near edge. */
  offset: number
  width: number
  height: number
  /** Height of the bottom edge above the floor. Doors default to 0, windows to 0.9. */
  sill?: number
}

export type Wall = {
  id: string
  from: Point
  to: Point
  /** Falls back to the floor's `wallThickness`. */
  thickness?: number
  openings?: Opening[]
}

export type Room = {
  id: string
  name: string
  /** Where the name is drawn in the plan. */
  label: Point
}

export type Floor = {
  id: string
  name: string
  /** Height of this floor's surface above the ground floor's. */
  elevation: number
  /** Wall height. */
  height: number
  wallThickness: number
  rooms: Room[]
  walls: Wall[]
}

/** Where the house stands, for sunlight. */
export type Site = {
  latitude: number
  longitude: number
  /** IANA zone the clock times in the sun panel are read in. */
  timeZone: string
  /** True north, degrees clockwise from the plan's up. The app lets you adjust it; this is the default. */
  north: number
}

export type HouseLayout = {
  name: string
  site: Site
  floors: Floor[]
}

/** Which face of a wall: walking from `from` to `to` in the plan (north up), 'a' is on the right, 'b' on the left. */
export type WallSide = 'a' | 'b'

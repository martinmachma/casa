// Plan coordinates are metres: x grows east, y grows south. 3D maps plan (x, y) to (x, z).
export type Point = [x: number, y: number]

/** An axis-aligned plan rectangle, metres. */
export type Rect = { x0: number; x1: number; y0: number; y1: number }

export type Opening = {
  /**
   * A passage is a gap with nothing filling it (like the way onto the stairs). A sliding door is a glazed panel that
   * slides along the wall towards its `to` end; a door swings into side `swing`, hinged at its `hinge` end.
   */
  type: 'door' | 'sliding' | 'window' | 'passage'
  /** Distance from the wall's `from` point to the opening's near edge. */
  offset: number
  width: number
  height: number
  /** Height of the bottom edge above the floor. Doors default to 0, windows to 0.9. */
  sill?: number
  /** Doors: which end of the wall the hinge is nearer. Defaults to 'from'. */
  hinge?: 'from' | 'to'
  /** Doors: the side the leaf opens into. Defaults to 'a'. */
  swing?: WallSide
}

export type Wall = {
  id: string
  from: Point
  to: Point
  /** Falls back to the floor's `wallThickness`. */
  thickness?: number
  /** Falls back to the floor's `height`; lower for half-height walls such as a WC's installation frame. */
  height?: number
  /** The wall it's built against (a shaft, a chimney breast), so it's cut away with that wall. */
  against?: string
  /** A parallel structural projection owned by this wall for picking, painting and cutaway. Its footprint stays here. */
  partOf?: string
  /** Rooms whose views leave it out, though it stands at their edge. */
  notIn?: string[]
  openings?: Opening[]
}

export type Room = {
  id: string
  name: string
  /** Where the name is drawn in the plan. */
  label: Point
  /** Its view looks in through its door, rather than from wherever shows it best. */
  view?: 'door'
  /** A space passed through or for storing things (hall, WC), listed apart from the rooms lived in. */
  minor?: boolean
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
  /** The slab's outer edge; the walls' bounding box when left out. */
  outline?: Point[]
  /** Holes in the slab, like the stairwell. */
  voids?: Rect[]
  /** Handrails along the edges of voids, each a polyline. */
  railings?: Point[][]
  /** Stairs up to the next floor. */
  stairs?: Stairs
}

/** Steps in walking order, each a plan polygon; they rise evenly to the next floor, the last one flush with it. */
export type Stairs = {
  name: string
  steps: Point[][]
  /** The rooms (on either floor) whose views the stairs belong to, as they're open onto them. */
  rooms?: string[]
}

/** A small building in the garden: a box with a door on one side. */
export type Shed = Rect & {
  id: string
  name: string
  height: number
  door?: { side: 'north' | 'east' | 'south' | 'west'; offset: number; width: number }
}

/** Everything outside, relative to the ground floor's surface. */
export type Outdoor = {
  /** Height of the lawn. */
  level: number
  garden: Point[]
  terrace: { name: string; level: number; outline: Point[] }
  /** Paved areas besides the terrace: under the overhang, the driveway and the path to the door. */
  paving?: { name: string; level: number; outline: Point[] }[]
  sheds: Shed[]
  /** Solid garden pieces standing on the lawn: rendered walls (bins, meters, mailbox) and green trellises. */
  blocks?: GardenBlock[]
}

export type GardenBlock = Rect & { id: string; name: string; height: number; kind: 'wall' | 'green' }

/** A flat roof on the top floor, edged by a parapet. */
export type Roof = {
  /** How high the parapet stands above the roof slab. */
  parapet: number
  /** The stack's plan footprint; it rises from the top floor through the roof. */
  chimney?: Rect
}

/** Where the house stands, for sunlight. */
export type Site = {
  latitude: number
  longitude: number
  /** IANA zone the clock times in the sun panel are read in. */
  timeZone: string
  /** True north, degrees clockwise from the plan's up (from the site plan). */
  north: number
}

export type HouseLayout = {
  name: string
  site: Site
  floors: Floor[]
  roof?: Roof
  outdoor?: Outdoor
}

/** Which face of a wall: walking from `from` to `to` in the plan (north up), 'a' is on the right, 'b' on the left. */
export type WallSide = 'a' | 'b'

/** A paintable face of a wall: one of its sides, or an end left bare (at an opening, or a wall stopping short). */
export type WallFace = WallSide | 'end'

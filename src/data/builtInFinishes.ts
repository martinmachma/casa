import { wallJoints, wallLength, wallPaintParts } from '../layout/geometry'
import type { Floor } from '../layout/types'
import { wcWallFinish } from '../layout/wc'
import type { HouseState } from './types'

const WC_REFERENCE = 'g-wc-reference'

/** Apply the WC redesign once to old paint, preserving adjacent rooms and all later deliberate edits. */
export const withBuiltInFinishes = (state: HouseState, floors: Floor[]): HouseState => {
  if (state.builtInFinishes?.includes(WC_REFERENCE)) return state
  const floor = floors.find((f) => f.id === 'ground')
  if (!floor) return state
  const faces = floor.walls.flatMap((wall) => {
    const face = wcWallFinish(floor, wall)
    if (!face) return []
    const parts = wallPaintParts(wall, floor)[face.side]
    const edges = [0, ...wallJoints(wall, floor)[face.side], wallLength(wall)]
    const affected = new Set(parts.filter((_, i) => edges[i] < face.u1 && edges[i + 1] > face.u0))
    return [{ ...face, wallId: wall.id, parts: new Set(parts), affected }]
  })
  if (!faces.length) return state
  const walls = state.walls.flatMap((paint) => {
    const face = faces.find((f) => f.wallId === paint.wallId && f.side === paint.side)
    if (!face) return [paint]
    if (paint.part !== undefined) return face.affected.has(paint.part) ? [] : [paint]
    // Old whole-side paint may extend through several rooms. Keep its colour on the other parts.
    return [...face.parts]
      .filter((part) => !face.affected.has(part))
      .filter((part) => !state.walls.some((p) => p.wallId === paint.wallId && p.side === paint.side && p.part === part))
      .map((part) => ({ ...paint, part }))
  })
  const wallAreas = state.wallAreas?.filter(
    (area) => !faces.some((f) => f.wallId === area.wallId && f.side === area.side && f.affected.has(area.part)),
  )
  return { ...state, walls, wallAreas, builtInFinishes: [...(state.builtInFinishes ?? []), WC_REFERENCE] }
}

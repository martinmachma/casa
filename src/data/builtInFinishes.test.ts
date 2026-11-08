import { expect, it } from 'vitest'
import { wallJoints, wallPaintParts, sidePart } from '../layout/geometry'
import { house } from '../layout/layout'
import { wcWallFinish } from '../layout/wc'
import { withBuiltInFinishes } from './builtInFinishes'
import { EMPTY_STATE, wallColorKey, wallPartColor, type HouseState } from './types'

const floor = house.floors.find((f) => f.id === 'ground')!
const west = floor.walls.find((w) => w.id === 'g-west')!
const partAt = (u: number) => wallPaintParts(west, floor).a[sidePart(wallJoints(west, floor).a, u)]
const wcPart = partAt(9.332 - 6)
const hallPart = partAt(9.332 - 8)

it('uncovers the WC tiles and white walls while keeping whole-side paint in adjacent rooms', () => {
  const state: HouseState = {
    ...EMPTY_STATE,
    walls: [
      { wallId: 'g-west', side: 'a', color: '#333333' },
      { wallId: 'g-west', side: 'a', part: hallPart, color: '#112233' },
      { wallId: 'g-storage-wc', side: 'a', color: '#333333' },
      { wallId: 'g-storage-wc', side: 'b', color: '#445566' },
      { wallId: 'u-north', side: 'a', color: '#778899' },
    ],
    wallAreas: [
      { id: 'wc-patch', wallId: 'g-west', side: 'a', part: wcPart, u0: 3, u1: 3.5, y0: 0, y1: 1, color: '#000' },
      { id: 'hall-patch', wallId: 'g-west', side: 'a', part: hallPart, u0: 1, u1: 2, y0: 0, y1: 1, color: '#fff' },
    ],
  }
  const original = JSON.stringify(state)
  const upgraded = withBuiltInFinishes(state, house.floors)
  const colors = new Map(upgraded.walls.map((p) => [wallColorKey(p.wallId, p.side, p.part), p.color]))
  expect(wallPartColor(colors, 'g-west', 'a', wcPart)).toBeUndefined()
  expect(wallPartColor(colors, 'g-west', 'a', hallPart)).toBe('#112233')
  expect(wallPartColor(colors, 'g-west', 'a', partAt(9.332 - 3.8))).toBe('#333333')
  expect(wallPartColor(colors, 'g-storage-wc', 'b', 0)).toBe('#445566')
  expect(wallPartColor(colors, 'u-north', 'a', 0)).toBe('#778899')
  expect(upgraded.wallAreas?.map((a) => a.id)).toEqual(['hall-patch'])
  expect(JSON.stringify(state)).toBe(original)
})

it('handles paint on each WC wall part and preserves later paint after saving and reopening', () => {
  const walls = floor.walls.flatMap((wall) => {
    const face = wcWallFinish(floor, wall)
    if (!face) return []
    const part = wallPaintParts(wall, floor)[face.side][
      sidePart(wallJoints(wall, floor)[face.side], (face.u0 + face.u1) / 2)
    ]
    return [{ wallId: wall.id, side: face.side, part, color: '#333333' }]
  })
  const upgraded = withBuiltInFinishes({ ...EMPTY_STATE, walls }, house.floors)
  expect(upgraded.walls).toEqual([])
  const repainted = JSON.parse(JSON.stringify({ ...upgraded, walls })) as HouseState
  expect(withBuiltInFinishes(repainted, house.floors)).toBe(repainted)
  expect(repainted.walls).toEqual(walls)
})

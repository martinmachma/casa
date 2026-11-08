import { expect, it } from 'vitest'
import { wallEndExtensions, wallLength } from './geometry'
import { house } from './layout'
import { wallRect } from './rooms'

it('matches Sara’s 450 × 415 mm corner shaft between the west and south wall faces', () => {
  const floor = house.floors.find((f) => f.id === 'upper')!
  const shaft = floor.walls.find((w) => w.id === 'u-shaft-s14')!
  const west = floor.walls.find((w) => w.id === 'u-west')!
  const south = floor.walls.find((w) => w.id === 'u-205-south')!
  const footprint = wallRect(shaft.from, shaft.to, shaft.thickness!)
  expect(footprint.x1 - footprint.x0).toBeCloseTo(0.45)
  expect(footprint.y1 - footprint.y0).toBeCloseTo(0.415)
  expect(footprint.x0).toBeCloseTo(west.from[0] + west.thickness! / 2)
  expect(footprint.y1).toBeCloseTo(south.from[1] - floor.wallThickness / 2)
  // The rendered caps and the measurement footprint must agree.
  const extension = wallEndExtensions(shaft, floor)
  expect(wallLength(shaft) + extension.from + extension.to).toBeCloseTo(0.45)
})

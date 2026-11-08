import { expect, it } from 'vitest'
import { BoxGeometry, Mesh, MeshBasicMaterial, Scene, Vector3 } from 'three'
import type { Wall } from '../layout/types'
import { blockers, clearView, crosses, mayBlock } from './clearView'

const box = (x: number, y: number, z: number, size = 0.5) => {
  const m = new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial())
  m.position.set(x, y, z)
  return m
}
const skip = (o: Parameters<typeof mayBlock>[0]) => !mayBlock(o, 'lamp', true)

it('looks from the way asked when nothing is in the way, and round what stands in it otherwise', () => {
  const scene = new Scene()
  const item = new Vector3(0, 1, 0)
  const back = new Vector3(0, 0, 1)
  scene.updateMatrixWorld()
  expect(clearView(scene, item, back, 2, 180, skip).toArray()).toEqual([0, 1, 2])

  scene.add(box(0, 1, 1, 1))
  scene.updateMatrixWorld()
  const eye = clearView(scene, item, back, 2, 180, skip)
  expect(blockers(scene, eye, item, skip, new Set()).size).toBe(0)
  expect(eye.distanceTo(item)).toBeGreaterThan(1)
})

it("doesn't count the item itself, or anything see-through", () => {
  const scene = new Scene()
  const own = box(0, 1, 1)
  own.userData.itemId = 'lamp'
  const glass = box(0, 1, 2)
  glass.material.transparent = true
  scene.add(own, glass)
  scene.updateMatrixWorld()
  expect(blockers(scene, new Vector3(0, 1, 3), new Vector3(0, 1, 0), skip, new Set()).size).toBe(0)
})

it('sees through a window in a wall but not a door', () => {
  const wall: Wall = {
    id: 'w',
    from: [-2, 0],
    to: [2, 0],
    openings: [{ type: 'window', offset: 0.5, width: 1, height: 1.2, sill: 0.9 }],
  }
  const crossing = (x: number, y: number) => crosses(wall, 0, 2.6, new Vector3(x, y, 2), new Vector3(x, y, -1))
  expect(crossing(-1, 1.5)).toBe(false)
  expect(crossing(1, 1.5)).toBe(true)
  expect(crossing(1, 2.8)).toBe(false)
  wall.openings![0].type = 'door'
  expect(crossing(-1, 1.5)).toBe(true)
})

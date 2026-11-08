import { expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Scene, Vector3 } from 'three'
import { reachable } from './pick'

const box = (z: number) => {
  const m = new Mesh(new BoxGeometry(1, 1, 0.2), new MeshBasicMaterial())
  m.position.z = z
  return m
}
const wall = (id: string, z: number) => {
  const g = new Group()
  g.userData.wallId = id
  g.add(box(z))
  return g
}

it("reaches a window's shade through the wall it's set in, but not through another wall in front", () => {
  const scene = new Scene()
  const own = wall('a', -5)
  const shade = new Mesh(new BoxGeometry(1, 1, 0.1), new MeshBasicMaterial({ visible: false }))
  shade.position.z = -5.3
  shade.userData.pastWalls = true
  own.add(shade)
  scene.add(own)
  scene.updateMatrixWorld()
  const ray = new Raycaster(new Vector3(0, 0, 0), new Vector3(0, 0, -1))
  expect(reachable(ray.intersectObject(shade), scene, ray)).not.toHaveLength(0)

  scene.add(wall('b', -2))
  scene.updateMatrixWorld()
  expect(reachable(ray.intersectObject(shade), scene, ray)).toHaveLength(0)
})

it('reaches measurement wall and floor targets through overlapping items, keeping the nearest target first', () => {
  const scene = new Scene()
  const item = box(-2)
  const wallTarget = box(-5)
  const floorTarget = box(-8)
  for (const target of [wallTarget, floorTarget]) {
    target.material = new MeshBasicMaterial({ visible: false })
    target.userData.measureTarget = true
  }
  scene.add(item, wallTarget, floorTarget)
  scene.updateMatrixWorld()
  const ray = new Raycaster(new Vector3(0.2, 0, 0), new Vector3(0, 0, -1))
  const hits = ray.intersectObjects([wallTarget, floorTarget])
  expect(reachable(hits, scene, ray).map((h) => h.object)).toEqual([wallTarget, floorTarget])

  // Other tools still cannot reach behind a solid item.
  for (const target of [wallTarget, floorTarget]) delete target.userData.measureTarget
  expect(reachable(hits, scene, ray)).toHaveLength(0)
})

it('leaves out what a Fade has hidden, though it stays mounted', () => {
  const scene = new Scene()
  const floor = new Group()
  const piece = box(-5)
  floor.add(piece)
  scene.add(floor)
  scene.updateMatrixWorld()
  const ray = new Raycaster(new Vector3(0, 0, 0), new Vector3(0, 0, -1))
  expect(reachable(ray.intersectObject(piece), scene, ray)).not.toHaveLength(0)

  floor.visible = false
  floor.userData.fadedAway = true
  piece.userData.measureTarget = true
  expect(reachable(ray.intersectObject(piece), scene, ray)).toHaveLength(0)
})

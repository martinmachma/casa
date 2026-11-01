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

import { expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { raycastIfShown } from './raycast'

it('picks through a hidden full wall, keeps its visible stub pickable, and restores full-wall picking', () => {
  const scene = new Group()
  const full = new Group()
  const stub = new Group()
  const geometry = new BoxGeometry(4, 3, 0.2)
  // Measurement targets hide their material, not their mesh.
  const material = new MeshBasicMaterial({ visible: false })
  const wall = new Mesh(geometry, material)
  wall.position.y = 1.5
  const lowWall = new Mesh(new BoxGeometry(4, 0.3, 0.2), material)
  lowWall.position.y = 0.15
  const behind = new Mesh(geometry, material)
  behind.position.set(0, 1.5, -2)
  for (const mesh of [wall, lowWall, behind]) mesh.raycast = raycastIfShown
  full.add(wall)
  stub.add(lowWall)
  scene.add(full, stub, behind)
  scene.updateMatrixWorld(true)
  const pick = (height: number) =>
    new Raycaster(new Vector3(0, height, 2), new Vector3(0, 0, -1)).intersectObject(scene, true)[0]?.object

  full.visible = false
  expect(pick(1)).toBe(behind)
  expect(pick(0.15)).toBe(lowWall)
  full.visible = true
  stub.visible = false
  expect(pick(1)).toBe(wall)
  expect(pick(0.15)).toBe(wall)
  geometry.dispose()
  lowWall.geometry.dispose()
  material.dispose()
})

import { describe, expect, it } from 'vitest'
import {
  Box3,
  BoxGeometry,
  DirectionalLight,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  Scene,
  Vector3,
} from 'three'
import { casterSignature, fitSunShadow } from './shadows'
import { houseSolid } from './houseGeometry'
import type { Floor } from '../layout/types'
import { house } from '../layout/layout'
import { sidePart, wallJoints, wallOwner, wallOwnerOffset } from '../layout/geometry'

const floor: Floor = {
  id: 'ground',
  name: 'Ground',
  elevation: 0,
  height: 2.6,
  wallThickness: 0.2,
  rooms: [],
  walls: [
    {
      id: 'north',
      from: [0, 0],
      to: [6, 0],
      openings: [{ type: 'window', offset: 2, width: 1, height: 1.2, sill: 0.9 }],
    },
    { id: 'east', from: [6, 0], to: [6, 5] },
    { id: 'south', from: [6, 5], to: [0, 5] },
    { id: 'west', from: [0, 5], to: [0, 0] },
  ],
}

describe('physical shadow geometry', () => {
  it('merges the shaft into its parent wall without losing its depth or changing paint coordinates', () => {
    const upper = house.floors[1]
    const shaft = upper.walls.find((w) => w.id === 'u-shaft-s15')!
    const owner = wallOwner(shaft, upper)
    expect(owner.id).toBe('u-middle')
    const offset = wallOwnerOffset(shaft, owner)
    const along = offset + (shaft.to[0] - shaft.from[0]) / 2
    expect(along).toBeCloseTo(2.2635)
    expect(sidePart(wallJoints(owner, upper).a, along)).toBe(1)
    const geometry = houseSolid(house.floors, house.roof, new Set(), house.outdoor?.level)
    const material = new MeshBasicMaterial({ side: FrontSide })
    const mesh = new Mesh(geometry, material)
    const southFace = (x: number) =>
      new Raycaster(new Vector3(x, upper.elevation + 1, 6), new Vector3(0, 0, -1)).intersectObject(mesh)[0].point.z
    expect(southFace(2.3)).toBeCloseTo(5.516)
    expect(southFace(1)).toBeCloseTo(5.366)
    geometry.dispose()
    material.dispose()
  })

  it('uses the visible slab surfaces and blocks light at the wall foot while leaving windows open', () => {
    const geometry = houseSolid([floor, { ...floor, id: 'upper', elevation: 2.9 }], { parapet: 0.4 }, new Set())
    const material = new MeshBasicMaterial({ side: FrontSide })
    const mesh = new Mesh(geometry, material)
    const hit = (from: number[], direction: number[]) =>
      new Raycaster(new Vector3(...from), new Vector3(...direction)).intersectObject(mesh)[0]
    expect(hit([1, 3.2, 1], [0, -1, 0]).point.y).toBeCloseTo(2.9)
    expect(hit([1, 2.5, 1], [0, 1, 0]).point.y).toBeCloseTo(2.6)
    expect(hit([1, 0.001, 1], [0, 0, -1]).point.z).toBeCloseTo(0.1)
    // A horizontal ray through the window reaches the opposite wall, not an accidental solid fill.
    expect(hit([2.5, 1.5, -1], [0, 0, 1]).point.z).toBeCloseTo(4.9)
    // Include the roof membrane and coping, whose shadow used to come from a lower surface.
    expect(hit([3, 10, 2], [0, -1, 0]).point.y).toBeCloseTo(5.82)
    expect(hit([0, 10, 2], [0, -1, 0]).point.y).toBeCloseTo(6.24)
    geometry.dispose()
    material.dispose()
  })

  it('invalidates all axes of an edited object and changes in caster visibility or geometry', () => {
    const scene = new Scene()
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    mesh.castShadow = true
    scene.add(mesh)
    const signature = () => {
      scene.updateMatrixWorld(true)
      return casterSignature(scene)
    }
    const initial = signature()
    mesh.scale.y = 2
    const resized = signature()
    expect(resized).not.toBe(initial)
    mesh.scale.z = 2
    expect(signature()).not.toBe(resized)
    const geometry = mesh.geometry
    mesh.geometry = new BoxGeometry(2, 1, 1)
    const replaced = signature()
    mesh.visible = false
    expect(signature()).not.toBe(replaced)
    geometry.dispose()
    mesh.geometry.dispose()
    mesh.material.dispose()
  })
})

it('fits the whole plot at low and high sun angles without changing the simulated direction', () => {
  const bounds = new Box3(new Vector3(-12, -0.6, -5), new Vector3(14, 7, 48))
  for (const altitude of [0.03, 0.3, 1.2]) {
    const light = new DirectionalLight()
    light.target = new Object3D()
    light.target.position.set(3, 2.9, 4)
    const direction = new Vector3(Math.cos(altitude), Math.sin(altitude), 0.2).normalize()
    light.position.copy(light.target.position).addScaledVector(direction, 35)
    light.shadow.mapSize.set(4096, 4096)
    fitSunShadow(light, bounds)
    expect(light.position.clone().sub(light.target.position).normalize().dot(direction)).toBeCloseTo(1, 12)
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const clip = new Vector3(x, y, z).project(light.shadow.camera)
          expect(Math.max(Math.abs(clip.x), Math.abs(clip.y), Math.abs(clip.z))).toBeLessThan(1)
        }
  }
})

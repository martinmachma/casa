import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { house } from '../layout/layout'
import { wallAngle, wallOwner, wallThickness } from '../layout/geometry'
import { roomMeshClassifier } from './roomMeshes'

const upper = house.floors[1]
const shaft = upper.walls.find((w) => w.id === 'u-shaft-s15')!
const parent = wallOwner(shaft, upper)

const wallPiece = (wall: typeof shaft, u0: number, u1: number) => {
  const group = new Group()
  group.userData = { wallId: wallOwner(wall, upper).id, physicalWallId: wall.id }
  group.position.set(wall.from[0], upper.elevation, wall.from[1])
  group.rotation.y = -wallAngle(wall)
  const mesh = new Mesh(new BoxGeometry(u1 - u0, upper.height, wallThickness(wall, upper)), new MeshStandardMaterial())
  mesh.position.set((u0 + u1) / 2, upper.height / 2, 0)
  group.add(mesh)
  group.updateMatrixWorld(true)
  return mesh
}

describe('room mesh membership', () => {
  it('keeps the projecting shaft sharp in Bedroom and outside the Landing', () => {
    const mesh = wallPiece(shaft, -0.073, 0.523)
    expect(roomMeshClassifier(upper, 'u-bedroom')(mesh)).toBe(true)
    expect(roomMeshClassifier(upper, 'u-hall')(mesh)).toBe(false)
    mesh.geometry.dispose()
    mesh.material.dispose()
  })

  it('keeps the exposed parent wall in Bedroom without painting over the shaft from behind', () => {
    const inBedroom = roomMeshClassifier(upper, 'u-bedroom')
    const exposed = wallPiece(parent, 1, 1.5)
    const behindShaft = wallPiece(parent, shaft.from[0] - parent.from[0], shaft.to[0] - parent.from[0])
    expect(inBedroom(exposed)).toBe(true)
    expect(inBedroom(behindShaft)).toBe(false)
    for (const mesh of [exposed, behindShaft]) {
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  })
})

import { Mesh, Raycaster, Vector3, type Intersection, type Material, type Object3D } from 'three'
import { openingSill } from '../layout/geometry'
import type { Wall } from '../layout/types'
import { raycastIfShown } from './raycast'

/** Stop this short of the item, so what it's on or against doesn't count as in the way. */
const SHORT = 0.15
/** Ways round an item a close-up may turn to, nearest the one it was meant to look from first (degrees). */
const TURNS = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180]
/** How much nearer it may come instead, each step costing about as much as a turn of 45°. */
const NEARER = [1, 0.6]
/** Or from a little below it, looking up (a light under a cupboard), for the same cost. */
const BELOW = -0.15

const ray = new Raycaster()
const dir = new Vector3()
const hits: Intersection[] = []

const materials = (m: Mesh) => [m.material as Material].flat()

/** What may stand in the way: nothing laid over the scene, nothing hidden, nothing part of the item looked at. */
export const mayBlock = (o: Object3D, itemId: string | undefined, walls: boolean) => {
  if (!(o instanceof Mesh) || o.type !== 'Mesh') return false
  for (let p: Object3D | null = o; p; p = p.parent) {
    const u = p.userData
    if (!p.visible || u.fadedAway || u.overlay || u.shadowOnly || u.debugTint) return false
    if (itemId !== undefined && u.itemId === itemId) return false
    if (!walls && u.wallId) return false
  }
  return true
}

/** Drawn solid: not an invisible hit box, not see-through glass, not a cut face. */
const solid = (list: Material[]) =>
  list.some((m) => m.visible && m.colorWrite && !m.transparent) && !list.every((m) => m.userData.section)

/**
 * The meshes drawn solid between `from` and `to` (stopping a little short of `to`). `original` gives a mesh's own
 * materials when they've been swapped for see-through ones, so what's already faded still counts.
 */
export const blockers = (
  scene: Object3D,
  from: Vector3,
  to: Vector3,
  skip: (o: Object3D) => boolean,
  out: Set<Mesh>,
  original: (m: Mesh) => Material[] = materials,
) => {
  out.clear()
  const far = from.distanceTo(to) - SHORT
  if (far <= 0) return out
  ray.set(from, dir.subVectors(to, from).normalize())
  ray.far = far
  scene.traverse((o) => {
    if (skip(o) || !solid(original(o as Mesh))) return
    hits.length = 0
    raycastIfShown.call(o as Mesh, ray, hits)
    if (hits.length) out.add(o as Mesh)
  })
  return out
}

/**
 * Whether the line from `from` to `to` passes through a wall standing from `bottom` to `top` (stopping short of `to`).
 * It's seen through a window or a passage in it, not a door, which is shut.
 */
export const crosses = (wall: Wall, bottom: number, top: number, from: Vector3, to: Vector3) => {
  const [ax, az] = wall.from
  const [bx, bz] = wall.to
  const dx = to.x - from.x
  const dz = to.z - from.z
  const ex = bx - ax
  const ez = bz - az
  const d = dx * ez - dz * ex
  if (Math.abs(d) < 1e-9) return false
  // How far along the line (t) and along the wall (u) they meet.
  const t = ((ax - from.x) * ez - (az - from.z) * ex) / d
  const u = ((ax - from.x) * dz - (az - from.z) * dx) / d
  const length = Math.hypot(dx, dz, to.y - from.y)
  if (t <= 0 || t >= 1 - SHORT / length || u < 0 || u > 1) return false
  const y = from.y + (to.y - from.y) * t
  if (y <= bottom || y >= top) return false
  const along = u * Math.hypot(ex, ez)
  return !wall.openings?.some(
    (o) =>
      o.type !== 'door' &&
      along > o.offset &&
      along < o.offset + o.width &&
      y - bottom > openingSill(o) &&
      y - bottom < openingSill(o) + o.height,
  )
}

/**
 * Where to look at an item from: `distance` back along `back`, or failing that the nearest way round it (within
 * `maxTurn` degrees), nearer in or from below, where nothing stands between. `walls` tells whether walls left standing seen from
 * an eye are in the way; if every way has one, those are let be (they're seen through), and if every way still has
 * something, it keeps the first.
 */
export const clearView = (
  scene: Object3D,
  item: Vector3,
  back: Vector3,
  distance: number,
  maxTurn: number,
  skip: (o: Object3D) => boolean,
  walls: (eye: Vector3) => boolean = () => false,
) => {
  const low = back.clone().setY(Math.min(back.y, BELOW)).normalize()
  const ways = low.equals(back) ? [back] : [back, low]
  const options = ways
    .flatMap((way, w) =>
      NEARER.flatMap((near, n) =>
        TURNS.filter((t) => Math.abs(t) <= maxTurn).map((turn) => ({
          way,
          turn,
          near,
          cost: Math.abs(turn) / 45 + n + w,
        })),
      ),
    )
    .sort((a, b) => a.cost - b.cost)
  const found = new Set<Mesh>()
  const up = new Vector3(0, 1, 0)
  const eyes = options.map(({ way, turn, near }) =>
    way
      .clone()
      .applyAxisAngle(up, (turn * Math.PI) / 180)
      .multiplyScalar(distance * near)
      .add(item),
  )
  const clear = eyes.filter((eye) => !blockers(scene, eye, item, skip, found).size)
  return clear.find((eye) => !walls(eye)) ?? clear[0] ?? eyes[0]
}

import { Mesh, type Intersection, type Material, type Object3D, type Raycaster } from 'three'

const materialsOf = (m: Mesh) => [m.material as Material].flat()

/** Shown: it and everything it's in is visible. */
export const shown = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/**
 * Drawn solid where the ray meets it: not an invisible hit box or a plane that only takes the pointer (colorWrite
 * off), not faded (a wall seen through as it fades out is looked past), and not cut away there. Overlays laid on a
 * surface (where paint would go, the selection wash) aren't either.
 */
const solid = (h: Intersection) => {
  const materials = materialsOf(h.object as Mesh)
  if (!materials.some((m) => m.visible && m.colorWrite && (!m.transparent || m.opacity >= 0.5))) return false
  return !materials[0].clippingPlanes?.some((p) => p.distanceToPoint(h.point) < 0)
}

/**
 * Everything drawn solid along the ray, nearest first, whether or not it takes the pointer: most meshes have their
 * raycast off outside planning, so each is tested directly. In a room's view, what's around the room is drawn
 * behind it, blurred, and is left out.
 */
export const solidHits = (scene: Object3D, ray: Raycaster) => {
  const hits: Intersection[] = []
  scene.traverse((o) => {
    if (o instanceof Mesh && !o.userData.debugTint && !o.userData.overlay && !o.userData.outside && shown(o))
      Mesh.prototype.raycast.call(o, ray, hits)
  })
  return hits.sort((a, b) => a.distance - b.distance).filter(solid)
}

/** Part of a piece of furniture. */
const inFurniture = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.itemId) return true
  return false
}

/** The wall it's part of, or set in. */
const wallOf = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.wallId) return p.userData.wallId as string
}

/**
 * What the pointer reaches: nothing out of focus around a room in its view, and nothing behind whatever solid
 * thing is in front, even one that doesn't take the pointer itself (a box in front of a door). A target marked
 * `pastFurniture` (the floor while a ceiling light is placed) is reached through furniture standing on it, and one
 * marked `pastWalls` (a window's shade, outside it) through the wall it's set in, though not through any other.
 */
export const reachable = (hits: Intersection[], scene: Object3D, ray: Raycaster) => {
  const near = hits.filter((h) => !h.object.userData.outside)
  if (!near.length) return near
  const solids = solidHits(scene, ray)
  const front = solids[0]
  const past = near.some((h) => h.object.userData.pastFurniture) && solids.find((h) => !inFurniture(h.object))
  const pastWall = (wall?: string) => solids.find((h) => !wall || wallOf(h.object) !== wall)
  return near.filter((h) => {
    const ud = h.object.userData
    const by = ud.pastFurniture ? past : ud.pastWalls ? pastWall(wallOf(h.object)) : front
    return !by || h.distance <= by.distance + 0.01
  })
}

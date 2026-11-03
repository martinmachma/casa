import { Mesh, type Intersection, type Object3D, type Raycaster } from 'three'

/**
 * Mesh raycasting that skips meshes hidden along with an ancestor (three.js hits invisible objects too), and the
 * parts of a mesh its clipping planes cut away.
 */
export function raycastIfShown(this: Mesh, raycaster: Raycaster, intersects: Intersection[]) {
  if (!this.visible) return
  for (let o: Object3D | null = this.parent; o; o = o.parent) if (!o.visible) return
  const planes = (Array.isArray(this.material) ? this.material[0] : this.material)?.clippingPlanes
  if (!planes?.length) return Mesh.prototype.raycast.call(this, raycaster, intersects)
  const hits: Intersection[] = []
  Mesh.prototype.raycast.call(this, raycaster, hits)
  intersects.push(...hits.filter((h) => !planes.some((p) => p.distanceToPoint(h.point) < 0)))
}

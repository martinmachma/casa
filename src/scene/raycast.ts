import { Mesh, type Intersection, type Object3D, type Raycaster } from 'three'

/** Mesh raycasting that skips meshes hidden along with an ancestor (three.js hits invisible objects too). */
export function raycastIfShown(this: Mesh, raycaster: Raycaster, intersects: Intersection[]) {
  if (!this.visible) return
  for (let o: Object3D | null = this.parent; o; o = o.parent) if (!o.visible) return
  Mesh.prototype.raycast.call(this, raycaster, intersects)
}

import { Box3, DirectionalLight, Mesh, Vector3, type Object3D } from 'three'

const corners = (box: Box3) =>
  [box.min.x, box.max.x].flatMap((x) =>
    [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => new Vector3(x, y, z))),
  )

/** Fit the light's view to real casters and receivers, without changing its direction. */
export const fitSunShadow = (light: DirectionalLight, bounds: Box3) => {
  if (bounds.isEmpty()) return
  const target = light.target.getWorldPosition(new Vector3())
  const direction = light.position.clone().sub(target).normalize()
  const distance = Math.max(
    35,
    bounds.getSize(new Vector3()).length() + target.distanceTo(bounds.getCenter(new Vector3())),
  )
  light.position.copy(target).addScaledVector(direction, distance)
  light.updateMatrixWorld()
  const camera = light.shadow.camera
  camera.position.copy(light.position)
  camera.lookAt(target)
  camera.updateMatrixWorld()
  const view = new Box3().setFromPoints(corners(bounds).map((p) => p.applyMatrix4(camera.matrixWorldInverse)))
  // A filter footprint outside the bounds must still have valid shadow texels.
  const margin = 0.3
  const width = view.max.x - view.min.x + margin * 2
  const height = view.max.y - view.min.y + margin * 2
  const texelX = width / light.shadow.mapSize.x
  const texelY = height / light.shadow.mapSize.y
  const x = Math.round((view.min.x + view.max.x) / 2 / texelX) * texelX
  const y = Math.round((view.min.y + view.max.y) / 2 / texelY) * texelY
  camera.left = x - width / 2
  camera.right = x + width / 2
  camera.bottom = y - height / 2
  camera.top = y + height / 2
  camera.near = Math.max(0.1, -view.max.z - margin)
  camera.far = Math.max(camera.near + 1, -view.min.z + margin)
  camera.updateProjectionMatrix()
}

/** Full transforms and geometry identity: resizing in y/z or replacing a door must invalidate shadows too. */
export const casterSignature = (scene: Object3D) => {
  const parts: (number | string)[] = []
  scene.traverseVisible((o) => {
    if (!(o instanceof Mesh) || !o.castShadow) return
    parts.push(o.id, o.geometry.id, o.geometry.attributes.position?.version ?? 0, ...o.matrixWorld.elements)
    for (const m of [o.material].flat()) {
      parts.push(m.visible ? 1 : 0, m.side, m.shadowSide ?? -1, m.alphaTest)
      if (m.clipShadows) for (const p of m.clippingPlanes ?? []) parts.push(...p.normal.toArray(), p.constant)
    }
  })
  return parts.join(',')
}

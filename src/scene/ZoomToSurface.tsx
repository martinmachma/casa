import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Raycaster, Vector2, Vector3, type Intersection, type Material, type Object3D } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

const shown = (o: Object3D | null): boolean => !o || (o.visible && shown(o.parent))
const solid = (hit: Intersection) => {
  const m = (hit.object as { material?: Material | Material[] }).material
  const first = Array.isArray(m) ? m[0] : m
  return !!first && first.visible && (!first.transparent || first.opacity > 0.5) && shown(hit.object)
}

/**
 * Wheel zoom closes in on the target, which can hang in midair or sit behind the floor. Before each notch, slide the
 * target along the line of sight to the depth of whatever is under the cursor, so the zoom ends just short of it.
 */
export const ZoomToSurface = () => {
  const { gl, camera, scene, controls } = useThree()
  useEffect(() => {
    const orbit = controls as OrbitControlsImpl | null
    if (!orbit || !('isPerspectiveCamera' in camera)) return
    const ray = new Raycaster()
    const pointer = new Vector2()
    const ahead = new Vector3()
    const wheel = (e: WheelEvent) => {
      if (!orbit.enabled || e.deltaY >= 0) return
      const box = gl.domElement.getBoundingClientRect()
      pointer.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1)
      ray.setFromCamera(pointer, camera)
      const hit = ray.intersectObject(scene, true).find(solid)
      if (!hit) return
      camera.getWorldDirection(ahead)
      const depth = hit.point.clone().sub(camera.position).dot(ahead)
      if (depth > 0) orbit.target.copy(camera.position).addScaledVector(ahead, depth)
    }
    // Capture, so the target has moved before the controls handle the same wheel event.
    gl.domElement.addEventListener('wheel', wheel, { capture: true, passive: true })
    return () => gl.domElement.removeEventListener('wheel', wheel, { capture: true })
  }, [gl, camera, scene, controls])
  return null
}

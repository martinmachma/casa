import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Mesh, Raycaster, Vector2, type Intersection, type Material, type Object3D } from 'three'
import { useDebug } from '../debug'

/** What a debug label says for the thing a mesh is part of: an item or device, or a wall. */
const labelOf = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) {
    if (p.userData.debug) return p.userData.debug as string
    if (p.userData.wallId) return `wall ${p.userData.wallId}`
  }
}

/** Drawn where the ray meets it: not hidden, not an invisible hit box, not cut away there. */
const seen = (h: Intersection) => {
  const materials = [(h.object as Mesh).material as Material].flat()
  if (!materials.some((m) => m.visible)) return false
  return !materials[0].clippingPlanes?.some((p) => p.distanceToPoint(h.point) < 0)
}

const shown = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/** In debug mode, the item, device or wall under the pointer is named in a tag beside it. */
export const DebugHover = () => {
  const debug = useDebug()
  const { gl, scene, get } = useThree()
  useEffect(() => {
    if (!debug) return
    const tag = document.createElement('div')
    tag.className = 'debug-label debug-hover'
    tag.hidden = true
    document.body.append(tag)
    const ray = new Raycaster()
    const at = new Vector2()
    let frame = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = gl.domElement.getBoundingClientRect()
        at.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        // The camera changes with the view (orbit, room, walk), so it's read as the pointer moves.
        ray.setFromCamera(at, get().camera)
        // Outside planning most meshes don't take the pointer (their raycast is off), so each is tested directly.
        // Whatever is drawn in front hides what's behind it, named or not (a floor, a ceiling).
        const hits: Intersection[] = []
        scene.traverse((o) => {
          // In a room's view, what's around the room is drawn behind it, blurred, and can't be picked.
          if (o instanceof Mesh && shown(o) && !o.userData.outside) Mesh.prototype.raycast.call(o, ray, hits)
        })
        const hit = hits.sort((a, b) => a.distance - b.distance).find(seen)
        const label = hit && labelOf(hit.object)
        tag.hidden = !label
        if (!label) return
        tag.textContent = label
        tag.style.left = `${e.clientX + 12}px`
        tag.style.top = `${e.clientY + 12}px`
      })
    }
    const leave = () => (tag.hidden = true)
    gl.domElement.addEventListener('pointermove', move)
    gl.domElement.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(frame)
      gl.domElement.removeEventListener('pointermove', move)
      gl.domElement.removeEventListener('pointerleave', leave)
      tag.remove()
    }
  }, [debug, gl, scene, get])
  return null
}

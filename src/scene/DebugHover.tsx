import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Mesh, MeshBasicMaterial, Raycaster, Vector2, type Intersection, type Material, type Object3D } from 'three'
import { useDebug } from '../debug'

/** The item, device or wall a mesh is part of, and what a debug tag says for it. */
const thingOf = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) {
    if (p.userData.debug) return { root: p, label: p.userData.debug as string, id: p.userData.itemId as string }
    if (p.userData.wallId) return { root: p, label: `wall ${p.userData.wallId}`, id: p.userData.wallId as string }
  }
}

const materialsOf = (m: Mesh) => [m.material as Material].flat()

/**
 * Drawn solid where the ray meets it: not hidden, not an invisible hit box, not cut away there, and not faded
 * (a wall seen through as it fades out is looked past).
 */
const seen = (h: Intersection) => {
  const materials = materialsOf(h.object as Mesh)
  // Catch planes that only take the pointer don't draw anything (colorWrite off).
  if (!materials.some((m) => m.visible && m.colorWrite && (!m.transparent || m.opacity >= 0.5))) return false
  return !materials[0].clippingPlanes?.some((p) => p.distanceToPoint(h.point) < 0)
}

const shown = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/**
 * In debug mode, the item, device or wall under the pointer is named in a tag beside it and tinted all over, so
 * it's clear what's being pointed at. Clicking it copies its id.
 */
export const DebugHover = () => {
  const debug = useDebug()
  const { gl, scene, get, invalidate } = useThree()
  useEffect(() => {
    if (!debug) return
    const tag = document.createElement('div')
    tag.className = 'debug-label debug-hover'
    tag.hidden = true
    document.body.append(tag)
    const tint = new MeshBasicMaterial({
      color: '#3b82f6',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
    let lit: { root: Object3D; overlays: Mesh[] } | undefined
    let pointed: ReturnType<typeof thingOf>
    const light = (root: Object3D | undefined) => {
      if (lit?.root === root) return
      lit?.overlays.forEach((o) => o.removeFromParent())
      lit = undefined
      if (root) {
        const overlays: Mesh[] = []
        root.traverse((o) => {
          if (!(o instanceof Mesh) || o.userData.debugTint || !shown(o)) return
          if (!materialsOf(o).some((m) => m.visible)) return
          const overlay = new Mesh(o.geometry, tint)
          overlay.userData.debugTint = true
          overlay.raycast = () => {}
          overlays.push(overlay)
        })
        // Added after the walk, so the walk doesn't step into them.
        let i = 0
        root.traverse((o) => {
          if (o instanceof Mesh && !o.userData.debugTint && shown(o) && materialsOf(o).some((m) => m.visible))
            o.add(overlays[i++])
        })
        lit = { root, overlays }
      }
      invalidate()
    }
    // A short note at the bottom of the screen, like the app's other toasts.
    let note: HTMLDivElement | undefined
    let noteTimer = 0
    const notify = (text: string) => {
      note ??= document.body.appendChild(
        Object.assign(document.createElement('div'), { className: 'toast debug-toast' }),
      )
      note.textContent = text
      note.hidden = false
      clearTimeout(noteTimer)
      noteTimer = window.setTimeout(() => note && (note.hidden = true), 1800)
    }
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
          if (o instanceof Mesh && !o.userData.debugTint && shown(o) && !o.userData.outside)
            Mesh.prototype.raycast.call(o, ray, hits)
        })
        const hit = hits.sort((a, b) => a.distance - b.distance).find(seen)
        const thing = hit && thingOf(hit.object)
        pointed = thing
        light(thing?.root)
        tag.hidden = !thing
        if (!thing) return
        tag.textContent = thing.label
        tag.style.left = `${e.clientX + 12}px`
        tag.style.top = `${e.clientY + 12}px`
      })
    }
    const leave = () => {
      tag.hidden = true
      pointed = undefined
      light(undefined)
    }
    // A click, not the end of a drag turning the view.
    let down = new Vector2()
    const press = (e: PointerEvent) => (down = new Vector2(e.clientX, e.clientY))
    const click = (e: MouseEvent) => {
      if (!pointed?.id || down.distanceTo(new Vector2(e.clientX, e.clientY)) > 4) return
      const { id } = pointed
      navigator.clipboard.writeText(id).then(
        () => notify(`Copied ${id}`),
        () => notify(`Couldn't copy ${id}`),
      )
    }
    gl.domElement.addEventListener('pointermove', move)
    gl.domElement.addEventListener('pointerleave', leave)
    gl.domElement.addEventListener('pointerdown', press)
    gl.domElement.addEventListener('click', click)
    return () => {
      cancelAnimationFrame(frame)
      gl.domElement.removeEventListener('pointermove', move)
      gl.domElement.removeEventListener('pointerleave', leave)
      gl.domElement.removeEventListener('pointerdown', press)
      gl.domElement.removeEventListener('click', click)
      light(undefined)
      clearTimeout(noteTimer)
      note?.remove()
      tint.dispose()
      tag.remove()
    }
  }, [debug, gl, scene, get, invalidate])
  return null
}

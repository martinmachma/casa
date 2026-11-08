import { useFrame, useThree } from '@react-three/fiber'
import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group, Material, Mesh, Object3D } from 'three'
import { animating } from './MotionQuality'

export const FADE_SECONDS = 0.35
/** How much of a shade or device shows while the walls are cut away to see inside. */
export const GHOST_OPACITY = 0.35

type Own = { opacity: number; transparent: boolean; depthWrite: boolean }
// Each faded material's own settings, to go back to once it's fully shown again.
const own = new Map<Material, Own>()

/** The floor in view, or outside. Going from one to another cuts straight to it: nothing that follows from that fades. */
export const ViewedFloor = createContext('')

/** A material's own opacity settings, as they are when it isn't faded. */
export const unfaded = (m: Material): Own =>
  own.get(m) ?? { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite }

/**
 * Shows everything under the object as much as its fades allow. A fade is `userData.fade` (0 gone, 1
 * there) on any object; nested fades multiply, so a wall fading inside a floor that fades works out.
 */
export const applyFade = (root: Object3D) => {
  let above = 1
  for (let p = root.parent; p; p = p.parent) above *= p.userData.fade ?? 1
  const walk = (o: Object3D, outer: number) => {
    const amount = outer * (o.userData.fade ?? 1)
    const material = (o as Mesh).material
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      const saved = own.get(m)
      if (amount >= 1) {
        if (!saved) continue
        Object.assign(m, saved)
        m.needsUpdate = true
        own.delete(m)
        continue
      }
      if (!saved) own.set(m, { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite })
      if (!m.transparent) {
        m.transparent = true
        m.needsUpdate = true
      }
      m.depthWrite = false
      m.opacity = own.get(m)!.opacity * amount
    }
    for (const c of o.children) walk(c, amount)
  }
  walk(root, above)
}

/** Moves a fade one frame towards where it's headed. */
export const fadeStep = (now: number, target: number, delta: number) => {
  // A long idle gap (the view renders on demand) shouldn't skip the animation.
  const step = Math.min(delta, 1 / 30) / FADE_SECONDS
  return now + Math.max(-step, Math.min(step, target - now))
}

/** Faded right out by a `Fade`, so nothing in it takes the pointer. */
export const fadedAway = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.fadedAway) return true
  return false
}

/**
 * Fades its contents in when shown and out when hidden. Whatever is shown from the start, or by a switch of floor, is
 * just there. Faded away they stay mounted, only not drawn: taking them down would rebuild a whole floor, and link its shaders again, on
 * every switch.
 */
export const Fade = ({ shown, children }: { shown: boolean; children: ReactNode }) => {
  const group = useRef<Group>(null)
  const k = useRef(shown ? 1 : 0)
  const viewed = useContext(ViewedFloor)
  const lastViewed = useRef(viewed)
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => redraw(), [shown, redraw])
  useLayoutEffect(() => {
    const g = group.current
    if (!g || k.current) return
    g.userData.fade = 0
    g.userData.fadedAway = true
    g.visible = false
    applyFade(g)
  }, [])
  useFrame(({ invalidate }, delta) => {
    const g = group.current
    const target = shown ? 1 : 0
    const switched = lastViewed.current !== viewed
    lastViewed.current = viewed
    if (!g || (k.current === target && g.userData.fade === target)) return
    k.current = switched ? target : fadeStep(k.current, target, delta)
    g.userData.fade = k.current
    g.userData.fadedAway = !k.current
    g.visible = !!k.current
    applyFade(g)
    if (k.current !== target) {
      invalidate()
      animating()
    }
  })
  return <group ref={group}>{children}</group>
}

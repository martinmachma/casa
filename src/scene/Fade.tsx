import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Group, Material, Mesh, Object3D } from 'three'

export const FADE_SECONDS = 0.35

type Own = { opacity: number; transparent: boolean; depthWrite: boolean }
// Each faded material's own settings, to go back to once it's fully shown again.
const own = new Map<Material, Own>()

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

/** Fades its contents in when shown and out when hidden, keeping them until they've faded away. Whatever is shown from the start is just there. */
export const Fade = ({ shown, children }: { shown: boolean; children: ReactNode }) => {
  const group = useRef<Group>(null)
  const k = useRef(shown ? 1 : 0)
  const [present, setPresent] = useState(shown)
  if (shown && !present) setPresent(true)
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => redraw(), [shown, redraw])
  // Put back, it starts out unseen.
  useLayoutEffect(() => {
    const g = group.current
    if (!present || !g) return
    g.userData.fade = k.current
    applyFade(g)
  }, [present])
  useFrame(({ invalidate }, delta) => {
    const g = group.current
    const target = shown ? 1 : 0
    if (!g || (k.current === target && g.userData.fade === target)) return
    k.current = fadeStep(k.current, target, delta)
    g.userData.fade = k.current
    applyFade(g)
    if (k.current !== target) invalidate()
    else if (!target) setPresent(false)
  })
  return present ? <group ref={group}>{children}</group> : null
}

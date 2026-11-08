import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Floor } from '../layout/types'
import { useStable } from '../lib/useStable'
import { inRoom } from '../rooms/roomViews'

/** How far a tap may move, in CSS pixels, and how long it may last, before it's a drag turning the view. */
const SLOP = 8
const TAP_MS = 500
/** Taps this close round the room, in metres, still count as in it: its walls and what's on them. */
const MARGIN = 0.4

/** A tap on the view that lands on the floor's level away from the room. */
export const TapOutside = ({ floor, roomId, onTap }: { floor: Floor; roomId: string; onTap: () => void }) => {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const tap = useStable(onTap)
  useEffect(() => {
    const el = gl.domElement
    let down: { x: number; y: number; at: number; id: number } | undefined
    // Another finger down makes it a pinch, not a tap.
    const start = (e: PointerEvent) => {
      down = e.isPrimary ? { x: e.clientX, y: e.clientY, at: e.timeStamp, id: e.pointerId } : undefined
    }
    const end = (e: PointerEvent) => {
      const d = down
      down = undefined
      if (!d || d.id !== e.pointerId || e.timeStamp - d.at > TAP_MS) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > SLOP) return
      const box = el.getBoundingClientRect()
      const ndc = new Vector2(
        ((e.clientX - box.left) / box.width) * 2 - 1,
        -((e.clientY - box.top) / box.height) * 2 + 1,
      )
      const ray = new Raycaster()
      ray.setFromCamera(ndc, camera)
      const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -floor.elevation), new Vector3())
      if (!hit || !inRoom(floor, roomId, [hit.x, hit.z], MARGIN)) tap()
    }
    el.addEventListener('pointerdown', start)
    el.addEventListener('pointerup', end)
    return () => {
      el.removeEventListener('pointerdown', start)
      el.removeEventListener('pointerup', end)
    }
  }, [gl, camera, floor, roomId, tap])
  return null
}

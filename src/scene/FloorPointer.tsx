import { useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Point } from '../layout/types'

export type FloorPointer = RefObject<(() => Point | undefined) | undefined>

/** Projects on demand so a stationary cursor follows camera and active-floor changes too. */
export const FloorPointerTracker = ({ elevation, pointRef }: { elevation: number; pointRef: FloorPointer }) => {
  const getState = useThree((s) => s.get)
  const cursor = useRef<{ x: number; y: number } | undefined>(undefined)
  useEffect(() => {
    const canvas = getState().gl.domElement
    const move = (e: PointerEvent) => {
      cursor.current = { x: e.clientX, y: e.clientY }
    }
    const clear = () => {
      cursor.current = undefined
    }
    const leave = (e: PointerEvent) => {
      if (!e.relatedTarget) clear()
    }
    const raycaster = new Raycaster()
    const plane = new Plane(new Vector3(0, 1, 0), -elevation)
    const hit = new Vector3()
    const pointer = new Vector2()
    pointRef.current = () => {
      const at = cursor.current
      if (!at || document.elementFromPoint(at.x, at.y) !== canvas) return
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointer.set(((at.x - rect.left) / rect.width) * 2 - 1, 1 - ((at.y - rect.top) / rect.height) * 2)
      raycaster.setFromCamera(pointer, getState().camera)
      if (!raycaster.ray.intersectPlane(plane, hit) || !Number.isFinite(hit.x) || !Number.isFinite(hit.z)) return
      return [hit.x, hit.z]
    }
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerout', leave, true)
    window.addEventListener('blur', clear)
    return () => {
      pointRef.current = undefined
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerout', leave, true)
      window.removeEventListener('blur', clear)
    }
  }, [elevation, getState, pointRef])
  return null
}

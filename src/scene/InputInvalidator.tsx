import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/**
 * The canvas renders on demand. Input that may move the camera (keys, on-screen buttons, drags, the wheel) asks for a
 * frame; anything still moving after that keeps asking from its own useFrame.
 */
export const InputInvalidator = () => {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const frame = () => invalidate()
    const move = (e: PointerEvent) => e.buttons && invalidate()
    const events = ['keydown', 'keyup', 'pointerdown', 'pointerup', 'wheel', 'resize'] as const
    for (const e of events) window.addEventListener(e, frame, { passive: true })
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      for (const e of events) window.removeEventListener(e, frame)
      window.removeEventListener('pointermove', move)
    }
  }, [invalidate])
  return null
}

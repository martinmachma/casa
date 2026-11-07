import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { HalfFloatType, WebGLRenderTarget } from 'three'
import { makeTools } from './RoomBlur'

/** Long enough for the furniture to arrive and the ambient occlusion to patch what's in view. */
const WAIT_MS = 3000

/**
 * A room's blur draws the house into a render target, where every material needs a program of its own (linear output,
 * no tone mapping). Left to the first room opened, that's some twenty programs built on one tap, seconds on a phone,
 * so they're built off the main thread once the house has loaded, and again the first time each floor is looked at,
 * which fades other things and so needs other programs. Only asks for programs; nothing is drawn.
 */
export const WarmShaders = ({ ready, view }: { ready: boolean; view: string }) => {
  const get = useThree((s) => s.get)
  const warmed = useRef(new Set<string>())
  useEffect(() => {
    if (!ready || warmed.current.has(view)) return
    const timer = window.setTimeout(() => {
      warmed.current.add(view)
      const { gl, scene, camera } = get()
      const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
      // These stay undisposed: they hold the blur's programs for the room's own copies of the same shaders.
      const blur = makeTools()
      const previous = gl.getRenderTarget()
      gl.setRenderTarget(target)
      // The programs are asked for before this returns, and it's that render target they're chosen for.
      const compiled = gl.compileAsync(scene, camera)
      gl.compile(blur.scene, blur.camera)
      gl.setRenderTarget(null)
      gl.compile(blur.scene, blur.camera)
      gl.compile(blur.dimScene, blur.camera)
      gl.setRenderTarget(previous)
      void compiled.finally(() => target.dispose())
    }, WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [ready, view, get])
  return null
}

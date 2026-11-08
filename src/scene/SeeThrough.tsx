import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3, type Material, type Mesh } from 'three'
import { fadeStep } from './Fade'
import { animating } from './MotionQuality'
import { blockers, mayBlock } from './clearView'

/** How much shows of something left standing between the camera and an item looked at close up. */
const SEEN = 0.2
/** How far the camera moves before what's in the way is looked for again… */
const MOVED = 0.01
/** …or how long it waits, as walls are cut or put back round it. */
const AGAIN_MS = 250

type Ghost = { own: Material | Material[]; copies: Material[]; opacities: number[]; k: number }

/** Swaps a mesh's materials for see-through copies, to fade. */
const ghostOf = (mesh: Mesh): Ghost => {
  const copies = [mesh.material as Material].flat().map((m) => {
    const c = m.clone()
    c.transparent = true
    c.depthWrite = false
    return c
  })
  const ghost = { own: mesh.material, copies, opacities: copies.map((c) => c.opacity), k: 1 }
  mesh.material = Array.isArray(mesh.material) ? copies : copies[0]
  return ghost
}

/** Gives a mesh its own materials back. */
const restore = (mesh: Mesh, ghost: Ghost) => {
  mesh.material = ghost.own
  for (const c of ghost.copies) c.dispose()
}

/** Moves each fade a frame on, towards see-through for what's in the way; tells whether any is still moving. */
const fadeGhosts = (ghosts: Map<Mesh, Ghost>, inWay: Set<Mesh>, delta: number) => {
  let moving = false
  for (const [mesh, ghost] of ghosts) {
    const goal = inWay.has(mesh) ? SEEN : 1
    if (ghost.k === goal) continue
    ghost.k = fadeStep(ghost.k, goal, delta)
    moving = true
    if (ghost.k === 1) {
      restore(mesh, ghost)
      ghosts.delete(mesh)
    } else ghost.copies.forEach((c, i) => (c.opacity = ghost.opacities[i] * ghost.k))
  }
  return moving
}

/**
 * Whatever still stands between the camera and an item looked at close up (stairs, a cupboard, a wall left standing)
 * fades to see through, on its own copy of its materials. Flying in, it looks along the way the camera will come to
 * rest, so what's in the way is gone by the time it gets there.
 */
export const SeeThrough = ({ target, itemId, resting }: { target: Vector3; itemId: string; resting?: Vector3 }) => {
  const scene = useThree((s) => s.scene)
  const redraw = useThree((s) => s.invalidate)
  // A frame once it's landed, to look again from there.
  useEffect(() => redraw(), [resting, redraw])
  const ref = useRef({
    ghosts: new Map<Mesh, Ghost>(),
    inWay: new Set<Mesh>(),
    eye: new Vector3(Infinity, 0, 0),
    at: new Vector3(Infinity, 0, 0),
    checked: 0,
    flying: false,
  })
  const skip = useMemo(() => (o: Parameters<typeof mayBlock>[0]) => !mayBlock(o, itemId, true), [itemId])
  const own = useMemo(
    () => (m: Mesh) => [(ref.current.ghosts.get(m)?.own ?? m.material) as Material | Material[]].flat(),
    [],
  )

  useEffect(() => {
    const state = ref.current
    return () => {
      for (const [mesh, ghost] of state.ghosts) restore(mesh, ghost)
      state.ghosts.clear()
    }
  }, [])

  useFrame(({ camera, invalidate }, delta) => {
    const state = ref.current
    const eye = resting ?? camera.position
    const now = performance.now()
    // Looked at again once it's landed too, with the walls cut as they are from there.
    const landed = state.flying && !resting
    state.flying = !!resting
    if (
      landed ||
      eye.distanceTo(state.eye) > MOVED ||
      target.distanceTo(state.at) > MOVED ||
      now - state.checked > AGAIN_MS
    ) {
      state.checked = now
      state.eye.copy(eye)
      state.at.copy(target)
      blockers(scene, eye, target, skip, state.inWay, own)
      for (const mesh of state.inWay) if (!state.ghosts.has(mesh)) state.ghosts.set(mesh, ghostOf(mesh))
    }
    if (fadeGhosts(state.ghosts, state.inWay, delta)) {
      invalidate()
      animating()
    }
  })
  return null
}

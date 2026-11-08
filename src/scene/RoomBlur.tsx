import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, Object3D, WebGLRenderTarget, type Camera } from 'three'
import { floorRegions } from '../layout/rooms'
import { DIM, makeTools } from './blurTools'
import { roomMeshClassifier } from './roomMeshes'
import type { Floor } from '../layout/types'

// Every mesh stays on layer 0, so picking and the other views are untouched; the room's meshes are also on
// one layer, everything else on another, and an opened item on a third; each pass draws one of them.
const ROOM_LAYER = 1
const OUTSIDE_LAYER = 2
const ITEM_LAYER = 3
const BLUR_PASSES = 3
/** The outside is drawn at this much of the canvas's CSS size, whatever the pixel ratio (see MotionQuality). */
const OUTSIDE_SCALE = 0.5
/** How long the dimming takes to come and go, in ms. */
const DIM_IN = 220
const DIM_OUT = 320
/** How long the blur takes to clear after the room is left, in ms. */
const BLUR_OUT = 500

const ease = (t: number) => t * t * (3 - 2 * t)

/** A value that eases towards 0 or 1, and the item it's shown for, kept while it fades out. */
type Fade = { value: number; item?: string; last?: number }

/** Moves a fade on towards its item; true while it's still moving. */
const step = (f: Fade, item: string | undefined, now: number, fadeIn: number, fadeOut: number) => {
  if (item) f.item = item
  const target = item ? 1 : 0
  const dt = f.last === undefined ? 16 : now - f.last
  f.value = target ? Math.min(1, f.value + dt / fadeIn) : Math.max(0, f.value - dt / fadeOut)
  if (!f.value) f.item = undefined
  const moving = f.value !== target
  f.last = moving ? now : undefined
  return moving
}

/** Where a mesh was when it was last sorted, so only meshes that move are looked at again. */
type Sorted = { x: number; y: number; z: number; geometry: unknown; cells: unknown; inRoom: boolean }

/** The item (furniture or device) a mesh is part of, if any. */
const itemOf = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.itemId) return p.userData.itemId as string
}

/**
 * Draws the outside blurred, then the room's own meshes sharp over it: everything else is out of focus,
 * whatever stands where on screen. Each mesh is drawn once; shadows are only redrawn when something moves.
 * With an item open, everything else is dimmed, easing in and out, and it's drawn over it. Left, it all eases away.
 */
export const RoomBlur = ({
  floor,
  roomId,
  soften = true,
  open,
  leaving,
  onLeft,
}: {
  floor: Floor
  roomId: string
  /** Phones keep room picking and item dimming without the offscreen blur/compositing passes. */
  soften?: boolean
  open?: string
  leaving?: boolean
  onLeft?: () => void
}) => {
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => redraw(), [open, leaving, redraw])
  const dimming = useRef<Fade>({ value: 0 })
  const blurring = useRef<Fade>({ value: 1 })
  // What's around the room is marked as it's sorted, so the pointer passes it by (see `reachable`).
  const scene = useThree((s) => s.scene)
  useEffect(() => () => scene.traverse((o) => delete o.userData.outside), [scene])
  const cells = useMemo(() => floorRegions(floor).get(roomId)?.cells ?? [], [floor, roomId])
  const kit = useRef<ReturnType<typeof makeTools>>(undefined)
  useEffect(
    () => () => {
      const t = kit.current
      if (!t) return
      t.a.dispose()
      t.b.dispose()
      t.quad.geometry.dispose()
      t.quad.material.dispose()
      t.dim.geometry.dispose()
      t.dim.material.dispose()
    },
    [],
  )
  const sorted = useMemo(() => new WeakMap<Mesh, Sorted>(), [])
  const lastShadows = useRef(NaN)

  const inRoom = useMemo(() => roomMeshClassifier(floor, roomId), [floor, roomId])

  useFrame(({ gl, scene, camera, size, invalidate }) => {
    const now = performance.now()
    const dimMoving = step(dimming.current, open, now, DIM_IN, DIM_OUT)
    const blurMoving = step(blurring.current, leaving ? undefined : roomId, now, DIM_IN, BLUR_OUT)
    if (dimMoving || blurMoving) invalidate()
    const blur = ease(blurring.current.value)
    const shown = dimming.current.item
    scene.updateMatrixWorld()
    // Sort the meshes, and sum up where everything is, to tell when the shadows need redrawing.
    let shadows = 0
    let i = 0
    scene.traverseVisible((o) => {
      // The view's camera is in the scene too, and moving it moves no shadow.
      if ((o as Camera).isCamera) return
      const e = o.matrixWorld.elements
      i++
      shadows += i * (e[12] + 2 * e[13] + 3 * e[14] + 5 * e[0] + 7 * e[2])
      // Lines and sprites are sorted like meshes; lights and groups belong to both passes.
      const m = o as Mesh
      if (!m.geometry) {
        o.layers.enableAll()
        return
      }
      const material = m.material
      if (material && !Array.isArray(material)) shadows += i * 11 * material.opacity
      let s = sorted.get(m)
      if (!s || s.x !== e[12] || s.y !== e[13] || s.z !== e[14] || s.geometry !== m.geometry || s.cells !== cells) {
        s = { x: e[12], y: e[13], z: e[14], geometry: m.geometry, cells, inRoom: inRoom(m) }
        sorted.set(m, s)
      }
      const item = shown ? itemOf(o) : undefined
      const layer = shown && item === shown ? ITEM_LAYER : s.inRoom ? ROOM_LAYER : OUTSIDE_LAYER
      o.userData.outside = layer === OUTSIDE_LAYER
      for (const l of [ROOM_LAYER, OUTSIDE_LAYER, ITEM_LAYER]) {
        if (l === layer) o.layers.enable(l)
        else o.layers.disable(l)
      }
    })

    // A phone draws straight to the screen: no linear-output house variants to link on the first room tap.
    // Sorting still limits picking to this room, and an opened item's dim and overlay stay available.
    if (!soften) {
      camera.layers.set(0)
      gl.render(scene, camera)
      if (shown) {
        const tools = (kit.current ??= makeTools())
        tools.dim.material.uniforms.alpha.value = DIM * ease(dimming.current.value)
        const autoClear = gl.autoClear
        const background = scene.background
        gl.autoClear = false
        gl.render(tools.dimScene, tools.camera)
        scene.background = null
        camera.layers.set(ITEM_LAYER)
        gl.render(scene, camera)
        scene.background = background
        gl.autoClear = autoClear
        camera.layers.set(0)
      }
      if (leaving) onLeft?.()
      return
    }
    const tools = (kit.current ??= makeTools())
    // Sized and blurred by CSS pixels, not the drawing buffer's: the pixel ratio drops while the camera moves, and
    // the outside mustn't turn blurrier then and sharper again as it settles.
    const { a, b, quad, camera: flat } = tools
    const w = Math.max(1, Math.round(size.width * OUTSIDE_SCALE))
    const h = Math.max(1, Math.round(size.height * OUTSIDE_SCALE))
    if (a.width !== w || a.height !== h) {
      a.setSize(w, h)
      b.setSize(w, h)
    }
    const material = quad.material
    const pass = (from: WebGLRenderTarget, to: WebGLRenderTarget | null, x: number, y: number, tint = 0) => {
      material.uniforms.map.value = from.texture
      material.uniforms.dir.value.set((x * OUTSIDE_SCALE) / from.width, (y * OUTSIDE_SCALE) / from.height)
      material.uniforms.tint.value = tint
      gl.setRenderTarget(to)
      gl.render(tools.scene, flat)
    }

    const autoUpdate = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    // Shadows come from everything, so they're drawn with every layer in view, but only when something has
    // moved (turning the camera doesn't change them), and with nothing but one pixel actually drawn. A target's
    // scissor only takes effect as it's set as the target.
    // The house's lights also ask for their shadows to be redrawn (see HouseLights).
    if (shadows !== lastShadows.current || gl.shadowMap.needsUpdate) {
      lastShadows.current = shadows
      gl.shadowMap.needsUpdate = true
      camera.layers.set(0)
      a.scissor.set(0, 0, 1, 1)
      a.scissorTest = true
      gl.setRenderTarget(a)
      gl.render(scene, camera)
      a.scissorTest = false
    }
    gl.setRenderTarget(a)

    // The outside, blurred.
    camera.layers.set(OUTSIDE_LAYER)
    gl.render(scene, camera)
    for (let k = 0; k < BLUR_PASSES; k++) {
      pass(a, b, (1 + k) * blur, 0)
      pass(b, a, 0, (1 + k) * blur)
    }
    const autoClear = gl.autoClear
    // A colour background clears the screen whatever autoClear says.
    const background = scene.background
    // The quad and the dim leave the depth clear. Clearing it here instead would split the screen's pass in two, and
    // storing and reloading the antialiased picture costs far more than everything else in the frame.
    const over = (layer: number) => {
      gl.autoClear = false
      scene.background = null
      camera.layers.set(layer)
      gl.render(scene, camera)
      scene.background = background
      gl.autoClear = autoClear
    }
    pass(a, null, 0, 0, blur)
    // The room, sharp, over it.
    over(ROOM_LAYER)
    if (shown) {
      // Everything dimmed, then the item, sharp, over it.
      tools.dim.material.uniforms.alpha.value = DIM * ease(dimming.current.value)
      gl.autoClear = false
      gl.render(tools.dimScene, flat)
      gl.autoClear = autoClear
      over(ITEM_LAYER)
    }
    camera.layers.set(0)
    gl.shadowMap.autoUpdate = autoUpdate
    if (leaving && !blurMoving) {
      onLeft?.()
      invalidate()
    }
  }, 1)
  return null
}

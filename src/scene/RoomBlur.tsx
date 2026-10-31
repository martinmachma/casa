import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  Color,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import { floorRegions } from '../layout/rooms'
import { roomMeshClassifier } from './roomMeshes'
import type { Floor } from '../layout/types'

// Every mesh stays on layer 0, so picking and the other views are untouched; the room's meshes are also on
// one layer, everything else on another, and an opened item on a third; each pass draws one of them. A pointed
// at item is also on a fourth, for its outline.
const ROOM_LAYER = 1
const OUTSIDE_LAYER = 2
const ITEM_LAYER = 3
const OUTLINE_LAYER = 4
const BLUR_PASSES = 3
const TINT = new Color('#ebe7e1')
const ACCENT = new Color('#dd7f2e')
const DIM = 0.3
/** How long the dimming takes to come and go, and the outline, in ms. */
const DIM_IN = 220
const DIM_OUT = 320
const OUTLINE_IN = 120
const OUTLINE_OUT = 160
/** The outline's width, in CSS pixels. */
const OUTLINE_WIDTH = 2

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

const blurMaterial = () =>
  new ShaderMaterial({
    uniforms: { map: { value: null }, dir: { value: new Vector2() }, tint: { value: 0 }, color: { value: TINT } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D map; uniform vec2 dir; uniform float tint; uniform vec3 color; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv) * 0.227027;
        c += (texture2D(map, vUv + dir * 1.3846) + texture2D(map, vUv - dir * 1.3846)) * 0.3162162;
        c += (texture2D(map, vUv + dir * 3.2308) + texture2D(map, vUv - dir * 3.2308)) * 0.0702703;
        float grey = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb = mix(c.rgb, mix(vec3(grey), c.rgb, 0.8), tint);
        c.rgb = mix(c.rgb, color, tint * 0.25);
        gl_FragColor = vec4(c.rgb, 1.0);
        // Drawn to the screen, the linear picture gets the tone mapping and colour space the scene would have.
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  })

const makeTools = () => {
  // The outside is drawn at half size straight into `a`: it's blurred anyway, and that's a quarter of the pixels.
  const a = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
  const b = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
  const quad = new Mesh(new PlaneGeometry(2, 2), blurMaterial())
  // Drawn straight to the screen whatever the camera.
  quad.frustumCulled = false
  const scene = new Scene()
  scene.add(quad)
  // A dark wash over the whole picture, to set a highlighted item off from everything else.
  const dim = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      uniforms: { alpha: { value: DIM } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform float alpha; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); }',
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  )
  dim.frustumCulled = false
  const dimScene = new Scene()
  dimScene.add(dim)
  // The pointed at item's silhouette, and a ring drawn around it.
  const mask = new WebGLRenderTarget(1, 1)
  const white = new MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false })
  const ring = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      uniforms: {
        mask: { value: mask.texture },
        step: { value: new Vector2() },
        color: { value: ACCENT },
        alpha: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D mask; uniform vec2 step; uniform vec3 color; uniform float alpha; varying vec2 vUv;
        void main() {
          float inside = texture2D(mask, vUv).r;
          float near = 0.0;
          for (int i = 0; i < 12; i++) {
            vec2 o = vec2(cos(float(i) * 0.5236), sin(float(i) * 0.5236)) * step;
            near = max(near, max(texture2D(mask, vUv + o).r, texture2D(mask, vUv + o * 0.5).r));
          }
          // The ring, and a faint warm wash over the item itself.
          gl_FragColor = vec4(color, (near * (1.0 - inside) + inside * 0.12) * alpha);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  ring.frustumCulled = false
  const ringScene = new Scene()
  ringScene.add(ring)
  return { a, b, quad, scene, dim, dimScene, mask, white, ring, ringScene, camera: new OrthographicCamera() }
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
 * With an item open, everything else is dimmed, easing in and out, and it's drawn over it; an item pointed at
 * is outlined.
 */
export const RoomBlur = ({
  floor,
  roomId,
  open,
  hovered,
}: {
  floor: Floor
  roomId: string
  open?: string
  hovered?: string
}) => {
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => redraw(), [open, hovered, redraw])
  const dimming = useRef<Fade>({ value: 0 })
  const outline = useRef<Fade>({ value: 0 })
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
      t.mask.dispose()
      t.white.dispose()
      t.ring.geometry.dispose()
      t.ring.material.dispose()
    },
    [],
  )
  const sorted = useMemo(() => new WeakMap<Mesh, Sorted>(), [])
  const lastShadows = useRef(NaN)
  const size = useMemo(() => new Vector2(), [])

  const inRoom = useMemo(() => roomMeshClassifier(floor, roomId), [floor, roomId])

  useFrame(({ gl, scene, camera, invalidate }) => {
    const tools = (kit.current ??= makeTools())
    const now = performance.now()
    const dimMoving = step(dimming.current, open, now, DIM_IN, DIM_OUT)
    const outlineMoving = step(outline.current, hovered, now, OUTLINE_IN, OUTLINE_OUT)
    if (dimMoving || outlineMoving) invalidate()
    const shown = dimming.current.item
    const ringed = outline.current.item
    scene.updateMatrixWorld()
    // Sort the meshes, and sum up where everything is, to tell when the shadows need redrawing.
    let shadows = 0
    let i = 0
    scene.traverseVisible((o) => {
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
      const item = shown || ringed ? itemOf(o) : undefined
      const layer = shown && item === shown ? ITEM_LAYER : s.inRoom ? ROOM_LAYER : OUTSIDE_LAYER
      o.userData.outside = layer === OUTSIDE_LAYER
      for (const l of [ROOM_LAYER, OUTSIDE_LAYER, ITEM_LAYER]) {
        if (l === layer) o.layers.enable(l)
        else o.layers.disable(l)
      }
      if (ringed && item === ringed) o.layers.enable(OUTLINE_LAYER)
      else o.layers.disable(OUTLINE_LAYER)
    })

    gl.getDrawingBufferSize(size)
    const { a, b, quad, camera: flat } = tools
    const w = Math.max(1, Math.round(size.x / 2))
    const h = Math.max(1, Math.round(size.y / 2))
    if (a.width !== w || a.height !== h) {
      a.setSize(w, h)
      b.setSize(w, h)
    }
    const material = quad.material
    const pass = (from: WebGLRenderTarget, to: WebGLRenderTarget | null, x: number, y: number, tint = 0) => {
      material.uniforms.map.value = from.texture
      material.uniforms.dir.value.set(x / from.width, y / from.height)
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
      pass(a, b, 1 + k, 0)
      pass(b, a, 0, 1 + k)
    }
    const autoClear = gl.autoClear
    // A colour background clears the screen whatever autoClear says.
    const background = scene.background
    const over = (layer: number) => {
      gl.autoClear = false
      scene.background = null
      gl.clearDepth()
      camera.layers.set(layer)
      gl.render(scene, camera)
      scene.background = background
      gl.autoClear = autoClear
    }
    pass(a, null, 0, 0, 1)
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
    if (ringed) {
      // The item's silhouette, white on black, then a ring around it over everything.
      const { mask, white, ring } = tools
      if (mask.width !== size.x || mask.height !== size.y) mask.setSize(size.x, size.y)
      const clear = gl.getClearColor(new Color())
      const clearAlpha = gl.getClearAlpha()
      gl.setClearColor(0x000000, 1)
      scene.background = null
      scene.overrideMaterial = white
      camera.layers.set(OUTLINE_LAYER)
      gl.setRenderTarget(mask)
      gl.clear()
      gl.render(scene, camera)
      scene.overrideMaterial = null
      scene.background = background
      gl.setClearColor(clear, clearAlpha)
      gl.setRenderTarget(null)
      const width = OUTLINE_WIDTH * gl.getPixelRatio()
      ring.material.uniforms.step.value.set(width / size.x, width / size.y)
      ring.material.uniforms.alpha.value = ease(outline.current.value)
      gl.autoClear = false
      gl.render(tools.ringScene, flat)
      gl.autoClear = autoClear
    }
    camera.layers.set(0)
    gl.shadowMap.autoUpdate = autoUpdate
  }, 1)
  return null
}

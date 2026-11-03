import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  Color,
  type Camera,
  type Light,
  type WebGLRenderer,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Material,
  type Object3D,
  type Plane,
} from 'three'

// The pointed at item's meshes go on a layer of their own while its silhouette is drawn.
const OUTLINE_LAYER = 4
// Items drawn over the walls go on one too, with the lights so they're lit as they are in the scene.
const XRAY_LAYER = 5
const ACCENT = new Color('#dd7f2e')
/** How long the outline takes to come and go, in ms. */
const FADE_IN = 120
const FADE_OUT = 160
/** The outline's width, in CSS pixels. */
const WIDTH = 2

const ease = (t: number) => t * t * (3 - 2 * t)

const makeTools = () => {
  const mask = new WebGLRenderTarget(1, 1)
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
  // Drawn straight to the screen whatever the camera.
  ring.frustumCulled = false
  const ringScene = new Scene()
  ringScene.add(ring)
  // White, cut by the same planes as what it stands in for, so a cut item's silhouette is cut too.
  const whites = new Map<string, MeshBasicMaterial>()
  const planes = new WeakMap<Plane[], number>()
  const whiteFor = (m: Material) => {
    const clip = m.clippingPlanes ?? undefined
    if (clip && !planes.has(clip)) planes.set(clip, whites.size)
    const key = `${clip ? planes.get(clip) : '-'}:${m.side}`
    let white = whites.get(key)
    if (!white) {
      white = new MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false, side: m.side })
      white.clippingPlanes = clip ?? null
      whites.set(key, white)
    }
    return white
  }
  return { mask, ring, ringScene, flat: new OrthographicCamera(), whites, whiteFor }
}

/** Draws the given items again over everything already drawn, each still hiding its own far side. */
const drawOver = (gl: WebGLRenderer, scene: Scene, camera: Camera, ids: ReadonlySet<string>) => {
  const raised: Object3D[] = []
  const raise = (o: Object3D) => {
    o.layers.enable(XRAY_LAYER)
    raised.push(o)
  }
  scene.traverseVisible((o) => {
    if ((o as Light).isLight) raise(o)
    else if (ids.has(o.userData.itemId)) o.traverseVisible(raise)
  })
  const layers = camera.layers.mask
  const background = scene.background
  const autoClear = gl.autoClear
  const { autoUpdate, needsUpdate } = gl.shadowMap
  gl.shadowMap.autoUpdate = gl.shadowMap.needsUpdate = false
  scene.background = null
  camera.layers.set(XRAY_LAYER)
  gl.autoClear = false
  gl.clearDepth()
  gl.render(scene, camera)
  gl.autoClear = autoClear
  camera.layers.mask = layers
  scene.background = background
  Object.assign(gl.shadowMap, { autoUpdate, needsUpdate })
  raised.forEach((o) => o.layers.disable(XRAY_LAYER))
}

/**
 * Rings the smart item pointed at, wherever it can be picked, easing in and out; drawn over everything, so an
 * item behind a wall it's picked through still shows. Unless `over` (something else draws the scene first, as
 * RoomBlur does), it draws the scene itself. The `seen` items are drawn over the walls in front of them.
 */
export const ItemOutline = ({ item, over, seen }: { item?: string; over: boolean; seen?: readonly string[] }) => {
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => redraw(), [item, redraw])
  const kit = useRef<ReturnType<typeof makeTools>>(undefined)
  useEffect(
    () => () => {
      const t = kit.current
      t?.mask.dispose()
      t?.ring.geometry.dispose()
      t?.ring.material.dispose()
      t?.whites.forEach((m) => m.dispose())
    },
    [],
  )
  const fade = useRef<{ value: number; item?: string; last?: number }>({ value: 0 })
  const size = useMemo(() => new Vector2(), [])
  const clear = useMemo(() => new Color(), [])
  const seenKey = seen?.join() ?? ''
  const seenIds = useMemo(() => new Set(seenKey ? seenKey.split(',') : []), [seenKey])
  useEffect(() => redraw(), [seenIds, redraw])

  useFrame(({ gl, scene, camera, invalidate }) => {
    if (!over) gl.render(scene, camera)
    if (seenIds.size) drawOver(gl, scene, camera, seenIds)
    const f = fade.current
    const now = performance.now()
    if (item) f.item = item
    const dt = f.last === undefined ? 16 : now - f.last
    f.value = item ? Math.min(1, f.value + dt / FADE_IN) : Math.max(0, f.value - dt / FADE_OUT)
    if (!f.value) f.item = undefined
    const moving = f.value !== (item ? 1 : 0)
    f.last = moving ? now : undefined
    if (moving) invalidate()
    const ringed = f.item
    if (!ringed) return

    const tools = (kit.current ??= makeTools())
    // The item's meshes that are drawn, each swapped for white while its silhouette is drawn.
    const swapped: [Mesh, Material | Material[]][] = []
    const walk = (o: Object3D) => {
      if (!o.visible) return
      const m = o as Mesh
      // Thick selection lines are instanced quads, not solid surfaces. A plain mask material turns
      // their screen-space geometry into a large rectangle in the scene.
      const drawn =
        m.isMesh && !(o as { isLineSegments2?: boolean }).isLineSegments2 && [m.material].flat().find((x) => x.visible)
      if (drawn) {
        swapped.push([m, m.material])
        m.material = tools.whiteFor(drawn)
        m.layers.enable(OUTLINE_LAYER)
      }
      o.children.forEach(walk)
    }
    scene.traverseVisible((o) => {
      if (o.userData.itemId === ringed) walk(o)
    })
    if (!swapped.length) return

    const { mask, ring } = tools
    gl.getDrawingBufferSize(size)
    if (mask.width !== size.x || mask.height !== size.y) mask.setSize(size.x, size.y)
    const autoClear = gl.autoClear
    const background = scene.background
    gl.getClearColor(clear)
    const clearAlpha = gl.getClearAlpha()
    gl.setClearColor(0x000000, 1)
    scene.background = null
    const layers = camera.layers.mask
    // The silhouette leaves the shadows as they are.
    const { autoUpdate, needsUpdate } = gl.shadowMap
    gl.shadowMap.autoUpdate = gl.shadowMap.needsUpdate = false
    camera.layers.set(OUTLINE_LAYER)
    gl.setRenderTarget(mask)
    gl.clear()
    gl.render(scene, camera)
    camera.layers.mask = layers
    Object.assign(gl.shadowMap, { autoUpdate, needsUpdate })
    // Backwards, in case a mesh was taken twice (an item inside one with the same id).
    for (const [m, material] of swapped.reverse()) {
      m.material = material
      m.layers.disable(OUTLINE_LAYER)
    }
    scene.background = background
    gl.setClearColor(clear, clearAlpha)
    gl.setRenderTarget(null)
    const width = WIDTH * gl.getPixelRatio()
    ring.material.uniforms.step.value.set(width / size.x, width / size.y)
    ring.material.uniforms.alpha.value = ease(f.value)
    gl.autoClear = false
    gl.render(tools.ringScene, tools.flat)
    gl.autoClear = autoClear
  }, 2)
  return null
}

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  Color,
  HalfFloatType,
  Mesh,
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
// one layer, everything else on another, and a highlighted item on a third; each pass draws one of them.
const ROOM_LAYER = 1
const OUTSIDE_LAYER = 2
const ITEM_LAYER = 3
const BLUR_PASSES = 3
const TINT = new Color('#ebe7e1')
const DIM = 0.35

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
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, ${DIM}); }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  )
  dim.frustumCulled = false
  const dimScene = new Scene()
  dimScene.add(dim)
  return { a, b, quad, scene, dim, dimScene, camera: new OrthographicCamera() }
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
 * With an item highlighted, everything else is dimmed and it's drawn over it.
 */
export const RoomBlur = ({ floor, roomId, highlight }: { floor: Floor; roomId: string; highlight?: string }) => {
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => redraw(), [highlight, redraw])
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
  const size = useMemo(() => new Vector2(), [])

  const inRoom = useMemo(() => roomMeshClassifier(floor, roomId), [floor, roomId])

  useFrame(({ gl, scene, camera }) => {
    const tools = (kit.current ??= makeTools())
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
      const layer = highlight && itemOf(o) === highlight ? ITEM_LAYER : s.inRoom ? ROOM_LAYER : OUTSIDE_LAYER
      o.userData.outside = layer === OUTSIDE_LAYER
      for (const l of [ROOM_LAYER, OUTSIDE_LAYER, ITEM_LAYER]) {
        if (l === layer) o.layers.enable(l)
        else o.layers.disable(l)
      }
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
    if (highlight) {
      // Everything dimmed, then the item, sharp, over it.
      gl.autoClear = false
      gl.render(tools.dimScene, flat)
      gl.autoClear = autoClear
      over(ITEM_LAYER)
    }
    camera.layers.set(0)
    gl.shadowMap.autoUpdate = autoUpdate
  }, 1)
  return null
}

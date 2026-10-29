import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  Box3,
  Color,
  HalfFloatType,
  Mesh,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import { floorRegions } from '../layout/rooms'
import { roomEdges, roomWallSides } from '../rooms/roomViews'
import { wallThickness } from '../layout/geometry'
import type { Floor } from '../layout/types'

// Every mesh stays on layer 0, so picking and the other views are untouched; the room's meshes are also on
// one layer, everything else on another, and a highlighted item on a third; each pass draws one of them.
const ROOM_LAYER = 1
const OUTSIDE_LAYER = 2
const ITEM_LAYER = 3
// Slack for rounding where something stands right at the floor's edge.
const MARGIN = 0.02
// Something counts as in the room when this much of its footprint is.
const SAMPLES = 5
const MOSTLY = 0.6
const BLUR_PASSES = 3
const TINT = new Color('#ebe7e1')

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
  return { a, b, quad, scene, camera: new OrthographicCamera() }
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
 * With an item highlighted, only it stays sharp, drawn over everything else.
 */
export const RoomBlur = ({ floor, roomId, highlight }: { floor: Floor; roomId: string; highlight?: string }) => {
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => redraw(), [highlight, redraw])
  // Only the room's own things take the pointer; what's around it is out of focus and out of reach.
  const setEvents = useThree((s) => s.setEvents)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    setEvents({ filter: (hits) => hits.filter((h) => !h.object.userData.outside) })
    return () => {
      setEvents({ filter: undefined })
      scene.traverse((o) => delete o.userData.outside)
    }
  }, [setEvents, scene])
  const cells = useMemo(() => floorRegions(floor).get(roomId)?.cells ?? [], [floor, roomId])
  // Each wall along the room's outline: the way out of the room, and where its face on the room's side is.
  const outline = useMemo(() => {
    const faces = new Map<string, { out: [number, number]; face: number }>()
    for (const [id, out] of roomWallSides(floor, roomId)) {
      const wall = floor.walls.find((w) => w.id === id)!
      const axis = out[0] ? 0 : 1
      faces.set(id, { out: [out[0], out[1]], face: wall.from[axis] - (out[axis] * wallThickness(wall, floor)) / 2 })
    }
    return faces
  }, [floor, roomId])
  const edges = useMemo(() => roomEdges(floor, roomId), [floor, roomId])
  const kit = useRef<ReturnType<typeof makeTools>>(undefined)
  useEffect(
    () => () => {
      const t = kit.current
      if (!t) return
      t.a.dispose()
      t.b.dispose()
      t.quad.geometry.dispose()
      t.quad.material.dispose()
    },
    [],
  )
  const sorted = useMemo(() => new WeakMap<Mesh, Sorted>(), [])
  const lastShadows = useRef(NaN)
  const box = useMemo(() => new Box3(), [])
  const mid = useMemo(() => new Vector3(), [])
  const size = useMemo(() => new Vector2(), [])

  const inRoom = (m: Mesh) => {
    const g = m.geometry
    if (!g.boundingBox) g.computeBoundingBox()
    box.copy(g.boundingBox!).applyMatrix4(m.matrixWorld).getCenter(mid)
    // Stairs belong to the rooms they're open onto, on the floor they rise from and the one they reach.
    const rooms = m.userData.rooms as string[] | undefined
    if (rooms) return rooms.includes(roomId)
    if (mid.y < floor.elevation - 0.1 || mid.y > floor.elevation + floor.height + 0.1) return false
    // A wall's corner block belongs to both walls that meet there: it goes with any room it touches.
    if (m.userData.corner)
      return cells.some(
        (c) =>
          box.max.x > c.x0 - MARGIN * 2 &&
          box.min.x < c.x1 + MARGIN * 2 &&
          box.max.z > c.y0 - MARGIN * 2 &&
          box.min.z < c.y1 + MARGIN * 2,
      )
    // Mostly over the room's floor (or its walls): sampled on a grid, as a room needn't be a rectangle.
    let wallId: string | undefined
    for (let p: Object3D | null = m; p && !wallId; p = p.parent) wallId = p.userData.wallId
    // A wall along the room's outline, and whatever is set in it (doors, windows, however they're swung), stands
    // off the room's floor: it's judged only by where it is along the wall, just inside the room's face of it.
    const side = wallId ? outline.get(wallId) : undefined
    let inX = side?.out[0] ? side.face - side.out[0] * MARGIN * 2 : undefined
    let inZ = side?.out[1] ? side.face - side.out[1] * MARGIN * 2 : undefined
    // Another wall's end can stand flush in the room's outline (a wall running off from the room's corner):
    // that piece is judged just inside the room, where its end face is.
    if (wallId && !side)
      for (const { from, to, out } of edges) {
        const axis = out[0] ? 'x' : 'z'
        const across = out[0] ? 'z' : 'x'
        const k = out[0] ? 0 : 1
        const near = out[k] > 0 ? box.min[axis] : box.max[axis]
        const lo = Math.min(from[1 - k], to[1 - k])
        const hi = Math.max(from[1 - k], to[1 - k])
        if (Math.abs(near - from[k]) > MARGIN * 1.5 || box.max[across] <= lo || box.min[across] >= hi) continue
        if (out[0]) inX = from[0] - out[0] * MARGIN * 2
        else inZ = from[1] - out[1] * MARGIN * 2
        break
      }
    const over = (x: number, z: number) => {
      const px = inX ?? x
      const pz = inZ ?? z
      return cells.some((c) => px > c.x0 - MARGIN && px < c.x1 + MARGIN && pz > c.y0 - MARGIN && pz < c.y1 + MARGIN)
    }
    let inside = 0
    for (let i = 0; i < SAMPLES; i++)
      for (let j = 0; j < SAMPLES; j++) {
        const x = box.min.x + ((i + 0.5) / SAMPLES) * (box.max.x - box.min.x)
        const z = box.min.z + ((j + 0.5) / SAMPLES) * (box.max.z - box.min.z)
        if (over(x, z)) inside++
      }
    return inside >= SAMPLES * SAMPLES * MOSTLY
  }

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
    if (shadows !== lastShadows.current) {
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
    if (highlight) {
      // The room is drawn over the blurred outside and both blurred a little more, so the room still reads;
      // then the item, sharp, over everything.
      over(ROOM_LAYER)
      pass(a, b, 0.5, 0)
      pass(b, a, 0, 0.5)
      pass(a, null, 0, 0, 1)
      over(ITEM_LAYER)
    } else {
      pass(a, null, 0, 0, 1)
      // The room, sharp, over it.
      over(ROOM_LAYER)
    }
    camera.layers.set(0)
    gl.shadowMap.autoUpdate = autoUpdate
  }, 1)
  return null
}

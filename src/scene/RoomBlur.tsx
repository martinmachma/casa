import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  Box3,
  Color,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import { floorRegions } from '../layout/rooms'
import type { Floor } from '../layout/types'

// Room meshes are also on this layer; the crisp pass draws only them.
const ROOM_LAYER = 1
// How far past the room's floor something may sit and still belong to it: its walls, at most.
const MARGIN = 0.35
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
  const target = () => new WebGLRenderTarget(1, 1, { type: HalfFloatType })
  const quad = new Mesh(new PlaneGeometry(2, 2), blurMaterial())
  // Drawn straight to the screen whatever the camera.
  quad.frustumCulled = false
  const scene = new Scene()
  scene.add(quad)
  return { full: target(), a: target(), b: target(), quad, scene, camera: new OrthographicCamera() }
}

/**
 * Draws the house blurred, then the room's own meshes sharp over it: everything else is out of focus,
 * whatever stands where on screen.
 */
export const RoomBlur = ({ floor, roomId }: { floor: Floor; roomId: string }) => {
  const cells = useMemo(() => floorRegions(floor).get(roomId)?.cells ?? [], [floor, roomId])
  const kit = useRef<ReturnType<typeof makeTools>>(undefined)
  useEffect(
    () => () => {
      const t = kit.current
      if (!t) return
      t.full.dispose()
      t.a.dispose()
      t.b.dispose()
      t.quad.geometry.dispose()
      t.quad.material.dispose()
    },
    [],
  )
  const box = useMemo(() => new Box3(), [])
  const mid = useMemo(() => new Vector3(), [])
  const size = useMemo(() => new Vector2(), [])

  const inRoom = (m: Mesh) => {
    const g = m.geometry
    if (!g) return false
    if (!g.boundingBox) g.computeBoundingBox()
    box.copy(g.boundingBox!).applyMatrix4(m.matrixWorld).getCenter(mid)
    if (mid.y < floor.elevation - 0.1 || mid.y > floor.elevation + floor.height + 0.1) return false
    return cells.some(
      (c) => mid.x > c.x0 - MARGIN && mid.x < c.x1 + MARGIN && mid.z > c.y0 - MARGIN && mid.z < c.y1 + MARGIN,
    )
  }

  useFrame(({ gl, scene, camera }) => {
    const tools = (kit.current ??= makeTools())
    scene.updateMatrixWorld()
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) {
        if (inRoom(o as Mesh)) o.layers.enable(ROOM_LAYER)
        else o.layers.disable(ROOM_LAYER)
      } else o.layers.enableAll()
    })

    gl.getDrawingBufferSize(size)
    const { full, a, b, quad, camera: flat } = tools
    if (full.width !== size.x || full.height !== size.y) {
      full.setSize(size.x, size.y)
      a.setSize(size.x / 2, size.y / 2)
      b.setSize(size.x / 2, size.y / 2)
    }
    const material = quad.material
    const pass = (from: WebGLRenderTarget, to: WebGLRenderTarget | null, x: number, y: number, tint = 0) => {
      material.uniforms.map.value = from.texture
      material.uniforms.dir.value.set(x / from.width, y / from.height)
      material.uniforms.tint.value = tint
      gl.setRenderTarget(to)
      gl.render(tools.scene, flat)
    }

    // Everything, for the background (and the shadows, which the sharp pass reuses).
    camera.layers.set(0)
    gl.setRenderTarget(full)
    gl.render(scene, camera)
    pass(full, a, 1, 0)
    pass(a, b, 0, 1)
    for (let i = 1; i < BLUR_PASSES; i++) {
      pass(b, a, 1 + i, 0)
      pass(a, b, 0, 1 + i)
    }
    pass(b, null, 0, 0, 1)

    // The room, sharp, over it.
    const autoClear = gl.autoClear
    const shadows = gl.shadowMap.autoUpdate
    gl.autoClear = false
    gl.shadowMap.autoUpdate = false
    // A colour background clears the screen whatever autoClear says.
    const background = scene.background
    scene.background = null
    gl.clearDepth()
    camera.layers.set(ROOM_LAYER)
    gl.render(scene, camera)
    camera.layers.set(0)
    scene.background = background
    gl.autoClear = autoClear
    gl.shadowMap.autoUpdate = shadows
  }, 1)
  return null
}

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  Color,
  DepthTexture,
  DataTexture,
  Material,
  Mesh,
  MeshNormalMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  ShaderMaterial,
  UniformsUtils,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Object3D,
} from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { SSAOShader } from 'three/examples/jsm/shaders/SSAOShader.js'
import { receiverPlaneShadows, receiverPlaneShadowKey } from './shadowShader'
import { ceilingLightMask, fixtureLighting } from './lightEmission'

// Contact-scale occlusion of indirect light only. Direct sunlight and bulbs still rely on real shadow maps.
const RADIUS = 0.2
const SAMPLES = 16
const STRENGTH = 0.55

const makeTools = () => {
  const normal = new WebGLRenderTarget(1, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthTexture: new DepthTexture(1, 1),
  })
  const ao = new WebGLRenderTarget(1, 1, { depthBuffer: false })
  const blur = new WebGLRenderTarget(1, 1, { depthBuffer: false })
  const material = new ShaderMaterial({
    defines: { ...SSAOShader.defines, KERNEL_SIZE: SAMPLES },
    uniforms: UniformsUtils.clone(SSAOShader.uniforms),
    vertexShader: SSAOShader.vertexShader,
    fragmentShader: SSAOShader.fragmentShader,
    depthTest: false,
    depthWrite: false,
  })
  // A fixed hemisphere avoids changing the noise pattern whenever a view is remounted.
  material.uniforms.kernel.value = Array.from({ length: SAMPLES }, (_, i) => {
    const z = (i + 0.5) / SAMPLES
    const angle = i * 2.3999632297
    return new Vector3(
      Math.cos(angle) * Math.sqrt(1 - z * z),
      Math.sin(angle) * Math.sqrt(1 - z * z),
      z,
    ).multiplyScalar(0.1 + 0.9 * ((i + 1) / SAMPLES) ** 2)
  })
  // Fixed nonzero rotation, with the evenly distributed kernel above.
  material.uniforms.tNormal.value = normal.texture
  material.uniforms.tDepth.value = normal.depthTexture
  const noise = new DataTexture(new Uint8Array([127, 127, 127, 255]), 1, 1)
  noise.needsUpdate = true
  material.uniforms.tNoise.value = noise
  material.uniforms.kernelRadius.value = RADIUS
  const blurMaterial = new ShaderMaterial({
    uniforms: {
      map: { value: ao.texture },
      depth: { value: normal.depthTexture },
      texel: { value: new Vector2() },
      near: { value: 0.1 },
      far: { value: 100 },
      perspective: { value: true },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      #include <packing>
      uniform sampler2D map; uniform sampler2D depth; uniform vec2 texel;
      uniform float near; uniform float far; uniform bool perspective; varying vec2 vUv;
      float viewZ(vec2 uv) {
        float d = texture2D(depth, uv).r;
        return perspective ? perspectiveDepthToViewZ(d, near, far) : orthographicDepthToViewZ(d, near, far);
      }
      void main() {
        float z = viewZ(vUv); float sum = 0.0; float weights = 0.0;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
          vec2 uv = vUv + vec2(float(x), float(y)) * texel;
          float weight = exp(-abs(viewZ(uv) - z) / 0.04);
          sum += texture2D(map, uv).r * weight; weights += weight;
        }
        gl_FragColor = vec4(vec3(sum / max(weights, 0.0001)), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  })
  return { normal, ao, blur, noise, material, blurMaterial, quad: new FullScreenQuad(material) }
}

type Patched = {
  compile: Material['onBeforeCompile']
  key: Material['customProgramCacheKey']
  render: Material['onBeforeRender']
  wrapped: Material['onBeforeCompile']
  beforeRender: Material['onBeforeRender']
}

// Three.js owns these mutable material callbacks; they are not React state or props.
const restoreMaterial = (m: Material, p: Patched) => {
  if (m.onBeforeCompile === p.wrapped) {
    m.onBeforeCompile = p.compile
    m.customProgramCacheKey = p.key
    m.needsUpdate = true
  }
  if (m.onBeforeRender === p.beforeRender) m.onBeforeRender = p.render
}

/** Half-resolution SSAO, applied in the material before tone mapping, including the layered room view. */
export const AmbientOcclusion = () => {
  const tools = useMemo(() => makeTools(), [])
  const normalsRef = useRef(new Map<Material, MeshNormalMaterial>())
  const patchedRef = useRef(new Map<Material, Patched>())
  const viewport = useMemo(() => new Vector4(), [])
  const viewportSize = useMemo(() => ({ value: new Vector2(1, 1) }), [])
  const ceilingMask = useRef({ value: [] as number[] })
  const drawingSize = useMemo(() => new Vector2(), [])
  useEffect(() => {
    const normals = normalsRef.current
    const patched = patchedRef.current
    return () => {
      tools.noise.dispose()
      tools.normal.dispose()
      tools.ao.dispose()
      tools.blur.dispose()
      tools.material.dispose()
      tools.blurMaterial.dispose()
      tools.quad.dispose()
      for (const m of normals.values()) m.dispose()
      for (const [m, p] of patched) restoreMaterial(m, p)
      normals.clear()
      patched.clear()
    }
  }, [tools])

  useFrame(({ gl, scene, camera }) => {
    const normals = normalsRef.current
    const patched = patchedRef.current
    ceilingMask.current.value = ceilingLightMask(scene, camera)
    gl.getDrawingBufferSize(drawingSize)
    const scale = Math.min(0.5, 960 / Math.max(drawingSize.x, drawingSize.y))
    const w = Math.max(1, Math.round(drawingSize.x * scale))
    const h = Math.max(1, Math.round(drawingSize.y * scale))
    for (const rt of [tools.normal, tools.ao, tools.blur]) if (rt.width !== w || rt.height !== h) rt.setSize(w, h)
    const hidden: Object3D[] = []
    const replaced = new Map<Mesh, Material | Material[]>()
    const active = new Set<Material>()
    scene.traverseVisible((o) => {
      if (o instanceof Mesh) {
        const materials = [o.material].flat()
        for (const m of materials) {
          active.add(m)
          if (m instanceof MeshStandardMaterial && patched.get(m)?.wrapped !== m.onBeforeCompile) {
            const compile = m.onBeforeCompile
            const key = m.customProgramCacheKey
            const render = patched.get(m)?.render ?? m.onBeforeRender
            const programKey = key.call(m)
            const section = m.userData.section === true
            const aoAmount = { value: m.transparent || section ? 0 : STRENGTH }
            // Only artificial horizontal cut faces use indirect illumination. Vertical wall faces,
            // including shortened walls, keep direct light and their normal physical shadow comparisons.
            const lighting = section
              ? '#undef RE_Direct\n#undef RE_Direct_RectArea\n' + fixtureLighting
              : fixtureLighting
            const wrapped: Material['onBeforeCompile'] = (shader, renderer) => {
              compile.call(m, shader, renderer)
              shader.uniforms.casaAO = { value: tools.blur.texture }
              shader.uniforms.casaViewport = viewportSize
              shader.uniforms.casaCeilingLights = ceilingMask.current
              shader.uniforms.casaAOAmount = aoAmount
              shader.fragmentShader =
                'uniform sampler2D casaAO; uniform vec2 casaViewport; uniform float casaAOAmount;\n#if NUM_POINT_LIGHTS > 0\nuniform float casaCeilingLights[NUM_POINT_LIGHTS];\n#endif\n' +
                shader.fragmentShader
                  .replace('#include <shadowmap_pars_fragment>', receiverPlaneShadows)
                  .replace('#include <lights_fragment_begin>', lighting)
                  .replace(
                    '#include <aomap_fragment>',
                    `#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= mix(1.0, texture2D(casaAO, gl_FragCoord.xy / casaViewport).r, casaAOAmount);`,
                  )
            }
            const beforeRender: Material['onBeforeRender'] = (...args) => {
              render.apply(m, args)
              aoAmount.value = m.transparent || section ? 0 : STRENGTH
              gl.getCurrentViewport(viewport)
              viewportSize.value.set(viewport.z, viewport.w)
            }
            patched.set(m, { compile, key, render, wrapped, beforeRender })
            m.onBeforeCompile = wrapped
            m.customProgramCacheKey = () =>
              programKey + '-casa-ambient-section-' + section + '-' + receiverPlaneShadowKey
            m.onBeforeRender = beforeRender
            m.needsUpdate = true
          }
        }
        if (
          o.userData.shadowOnly ||
          materials.some((m) => !m.colorWrite || !m.depthWrite || m.transparent) ||
          materials.every((m) => m.userData.section)
        ) {
          hidden.push(o)
          return
        }
        replaced.set(o, o.material)
        const depthMaterials = materials.map((m) => {
          active.add(m)
          let normal = normals.get(m)
          if (!normal) {
            normal = new MeshNormalMaterial()
            normals.set(m, normal)
          }
          if (normal.side !== m.side || normal.clippingPlanes !== m.clippingPlanes) normal.needsUpdate = true
          normal.side = m.side
          normal.visible = m.visible && !m.userData.section
          normal.clippingPlanes = m.clippingPlanes
          // The normal/depth pass must resolve flush wall sides and end caps like the visible pass.
          normal.polygonOffset = m.polygonOffset
          normal.polygonOffsetFactor = m.polygonOffsetFactor
          normal.polygonOffsetUnits = m.polygonOffsetUnits

          return normal
        })
        o.material = Array.isArray(o.material) ? depthMaterials : depthMaterials[0]
      } else if ((o as { isLine?: boolean }).isLine || (o as { isSprite?: boolean }).isSprite) hidden.push(o)
    })
    for (const o of hidden) o.visible = false
    const target = gl.getRenderTarget()
    const autoUpdate = gl.shadowMap.autoUpdate
    const needsUpdate = gl.shadowMap.needsUpdate
    const background = scene.background
    const clearColor = gl.getClearColor(new Color())
    const clearAlpha = gl.getClearAlpha()
    const autoClear = gl.autoClear
    const layer = camera.layers.mask
    try {
      gl.shadowMap.autoUpdate = false
      gl.shadowMap.needsUpdate = false
      scene.background = null
      gl.autoClear = true
      camera.layers.set(0)
      gl.setClearColor('#7777ff', 1)
      gl.setRenderTarget(tools.normal)
      gl.render(scene, camera)
      const perspective = camera instanceof PerspectiveCamera
      const u = tools.material.uniforms
      if (tools.material.defines.PERSPECTIVE_CAMERA !== Number(perspective)) {
        tools.material.defines.PERSPECTIVE_CAMERA = Number(perspective)
        tools.material.needsUpdate = true
      }
      const near = (camera as PerspectiveCamera).near,
        far = (camera as PerspectiveCamera).far
      u.cameraNear.value = near
      u.cameraFar.value = far
      u.cameraProjectionMatrix.value.copy(camera.projectionMatrix)
      u.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse)
      u.resolution.value.set(w, h)
      // SSAOShader compares distances normalised by the camera range; keep the limits in metres.
      u.minDistance.value = 0.005 / (far - near)
      u.maxDistance.value = RADIUS / (far - near)
      tools.quad.material = tools.material
      gl.setRenderTarget(tools.ao)
      tools.quad.render(gl)
      const b = tools.blurMaterial.uniforms
      b.near.value = near
      b.far.value = far
      b.perspective.value = perspective
      b.texel.value.set(1 / w, 1 / h)
      tools.quad.material = tools.blurMaterial
      gl.setRenderTarget(tools.blur)
      tools.quad.render(gl)
    } finally {
      for (const [mesh, material] of replaced) mesh.material = material
      for (const o of hidden) o.visible = true
      scene.background = background
      camera.layers.mask = layer
      gl.autoClear = autoClear
      gl.shadowMap.autoUpdate = autoUpdate
      gl.shadowMap.needsUpdate = needsUpdate
      gl.setClearColor(clearColor, clearAlpha)
      gl.setRenderTarget(target)
    }
    for (const [m, normal] of normals)
      if (!active.has(m)) {
        normal.dispose()
        normals.delete(m)
      }
    for (const [m, p] of patched)
      if (!active.has(m)) {
        restoreMaterial(m, p)
        patched.delete(m)
      }
  })
  return null
}

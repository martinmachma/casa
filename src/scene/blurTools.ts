import {
  AlwaysDepth,
  Color,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three'

const TINT = new Color('#ebe7e1')
/** How dark everything else goes behind an open item. */
export const DIM = 0.3

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

export const makeTools = () => {
  // The outside is drawn small straight into `a`: it's blurred anyway, and that's a fraction of the pixels.
  const a = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
  const b = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
  const quad = new Mesh(new PlaneGeometry(2, 2), blurMaterial())
  // Drawn straight to the screen whatever the camera.
  quad.frustumCulled = false
  const scene = new Scene()
  scene.add(quad)
  // A dark wash over the whole picture, to set a highlighted item off from everything else. It also puts the depth
  // back to the far plane, so the item is drawn over everything without clearing it (see `over`).
  const dim = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      uniforms: { alpha: { value: DIM } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: 'uniform float alpha; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); }',
      transparent: true,
      depthFunc: AlwaysDepth,
    }),
  )
  dim.frustumCulled = false
  const dimScene = new Scene()
  dimScene.add(dim)
  return { a, b, quad, scene, dim, dimScene, camera: new OrthographicCamera() }
}

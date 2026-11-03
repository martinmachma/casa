import {
  DepthTexture,
  LessEqualCompare,
  LinearFilter,
  PointLight,
  UnsignedIntType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { scenePointLights } from './lightEmission'
import { pointShadowLayout, type ShadowTile } from './pointShadowLayout'

type Binding = {
  tile: ShadowTile
  extents: Vector2
  viewports: Vector4[]
  restore: () => void
}

/**
 * One depth texture for every bulb, rather than one GPU sampler per bulb. Three's normal shadow pass still
 * draws the physical house and furniture, using six atlas viewports instead of six separate cube faces.
 */
export class PointShadowAtlas {
  private target = new WebGLRenderTarget(1, 1, { depthTexture: new DepthTexture(1, 1, UnsignedIntType) })
  private bindings = new Map<PointLight, Binding>()
  private position = new Vector3()
  readonly uniforms = {
    casaPointShadowAtlas: { value: this.target.depthTexture },
    casaPointShadowTiles: { value: [] as Vector4[] },
    casaPointShadowQuality: { value: [] as number[] },
  }

  constructor() {
    const depth = this.target.depthTexture!
    depth.compareFunction = LessEqualCompare
    depth.minFilter = depth.magFilter = LinearFilter
    this.target.scissorTest = true
  }

  prepare(gl: WebGLRenderer, scene: Scene, camera: Camera, focus: Vector3) {
    scene.updateMatrixWorld()
    const lights = scenePointLights(scene, camera).filter((l) => l.castShadow)
    const current = new Set(lights)
    for (const [light, binding] of this.bindings)
      if (!current.has(light)) {
        binding.restore()
        this.bindings.delete(light)
      }

    // Keep the current detailed set until another bulb is meaningfully nearer. Orbit rotation alone cannot
    // change it; dimming a bulb cannot change its brightness or its neighbours' quality priority.
    const distance = (l: PointLight) => {
      const d = Math.max(1, l.getWorldPosition(this.position).distanceToSquared(focus))
      return d * (this.bindings.get(l)?.tile.size === 512 ? 0.75 : 1)
    }
    const ranked = [...lights].sort((a, b) => distance(a) - distance(b))
    const sizes = new Map(ranked.map((l, i) => [l, i < 4 ? 512 : i < 8 ? 256 : 128]))
    const { width, height, tiles } = pointShadowLayout(
      lights.map((l) => sizes.get(l)!),
      Math.min(4096, gl.capabilities.maxTextureSize),
    )
    const resized = this.target.width !== width || this.target.height !== height
    if (resized) this.target.setSize(width, height)

    lights.forEach((light, i) => {
      const tile = tiles[i]
      const shadow = light.shadow
      let binding = this.bindings.get(light)
      if (!binding) {
        const { getFrameExtents, getViewportCount, getViewport, dispose } = shadow
        shadow.map?.dispose()
        binding = {
          tile,
          extents: new Vector2(),
          viewports: [],
          restore: () => {
            shadow.map = null
            Object.assign(shadow, { getFrameExtents, getViewportCount, getViewport, dispose })
          },
        }
        const owned = binding
        // The renderer clears at the start of each light. Limit that clear to this bulb's six faces so
        // cached neighbouring shadows survive, including when only a door or one bulb moves.
        shadow.getFrameExtents = () => {
          const { x, y, size } = owned.tile
          this.target.scissor.set(x, y, size * 3, size * 2)
          return owned.extents
        }
        shadow.getViewportCount = () => 6
        shadow.getViewport = (face) => owned.viewports[face]
        // Removing one fixture must not dispose the shared texture used by the other rooms.
        shadow.dispose = () => {
          owned.restore()
          dispose.call(shadow)
        }
        this.bindings.set(light, binding)
        // Three normally refreshes this when it allocates a cube map. Supplying our atlas skips that
        // allocation, so apply the fixture's near/far planes before its first depth render.
        shadow.camera.updateProjectionMatrix()
        shadow.needsUpdate = true
      }
      const before = binding.tile
      if (resized || before.x !== tile.x || before.y !== tile.y || before.size !== tile.size) shadow.needsUpdate = true
      binding.tile = tile
      binding.extents.set(width / tile.size, height / tile.size)
      binding.viewports = Array.from(
        { length: 6 },
        (_, face) => new Vector4(tile.x / tile.size + (face % 3), tile.y / tile.size + Math.floor(face / 3), 1, 1),
      )
      shadow.map = this.target
      shadow.mapSize.set(tile.size, tile.size)
      this.uniforms.casaPointShadowTiles.value[i] = new Vector4(
        tile.x / width,
        tile.y / height,
        tile.size / width,
        tile.size / height,
      )
      // Far rooms keep occlusion, colour and brightness, using one filtered comparison instead of five.
      this.uniforms.casaPointShadowQuality.value[i] = tile.size >= 256 ? 1 : 0
      if (shadow.needsUpdate) gl.shadowMap.needsUpdate = true
    })
    this.uniforms.casaPointShadowTiles.value.length = lights.length
    this.uniforms.casaPointShadowQuality.value.length = lights.length
  }

  dispose() {
    for (const binding of this.bindings.values()) binding.restore()
    this.bindings.clear()
    this.target.dispose()
  }
}

import { describe, expect, it, vi } from 'vitest'
import { pointShadowLayout } from './pointShadowLayout'
import { PerspectiveCamera, PointLight, Scene, Vector3, type WebGLRenderer } from 'three'
import { PointShadowAtlas } from './PointShadowAtlas'

describe('point shadow atlas geometry', () => {
  it('keeps six faces of every bulb separate, including on a smaller GPU', () => {
    const sizes = [512, 128, 256, 512, ...Array<number>(40).fill(128)]
    for (const limit of [4096, 1024]) {
      const { width, height, tiles } = pointShadowLayout(sizes, limit)
      expect(tiles).toHaveLength(sizes.length)
      expect(width).toBeLessThanOrEqual(limit)
      expect(height).toBeLessThanOrEqual(limit)
      tiles.forEach((a, i) => {
        expect(a.size).toBeGreaterThan(0)
        expect(a.x + a.size * 3).toBeLessThanOrEqual(width)
        expect(a.y + a.size * 2).toBeLessThanOrEqual(height)
        for (const b of tiles.slice(i + 1))
          expect(
            a.x + a.size * 3 <= b.x || b.x + b.size * 3 <= a.x || a.y + a.size * 2 <= b.y || b.y + b.size * 2 <= a.y,
          ).toBe(true)
      })
    }
  })

  it('projects a room floor using the fixture near/far planes when the atlas replaces cube allocation', () => {
    const scene = new Scene()
    const light = new PointLight()
    light.castShadow = true
    light.shadow.camera.near = 0.1
    light.shadow.camera.far = 9
    scene.add(light)
    const atlas = new PointShadowAtlas()
    const gl = {
      capabilities: { maxTextureSize: 4096 },
      shadowMap: { needsUpdate: false },
      initRenderTarget: vi.fn(),
    } as unknown as WebGLRenderer
    atlas.prepare(gl, scene, new PerspectiveCamera(), new Vector3())
    const depth = new Vector3(0, 0, -2.6).applyMatrix4(light.shadow.camera.projectionMatrix).z * 0.5 + 0.5
    expect(depth).toBeCloseTo((9 * (2.6 - 0.1)) / (2.6 * (9 - 0.1)), 12)
    atlas.dispose()
  })

  it.each([1, 0.5])('keeps dark bulbs and their neighbours cached (detail %s)', (detail) => {
    const scene = new Scene()
    const lights = Array.from({ length: 12 }, (_, i) => {
      const light = new PointLight()
      light.position.set(i, 2.6, 0)
      light.castShadow = true
      light.shadow.autoUpdate = false
      scene.add(light)
      return light
    })
    const atlas = new PointShadowAtlas()
    const gl = {
      capabilities: { maxTextureSize: 4096 },
      shadowMap: { needsUpdate: false },
      initRenderTarget: vi.fn(),
    } as unknown as WebGLRenderer
    const camera = new PerspectiveCamera()
    const focus = new Vector3()
    atlas.prepare(gl, scene, camera, focus, false, detail)
    const tiles = atlas.uniforms.casaPointShadowTiles.value.map((v) => v.toArray())
    const map = lights[0].shadow.map!
    const size = [map.width, map.height]
    for (const light of lights) light.shadow.needsUpdate = false
    gl.shadowMap.needsUpdate = false

    lights[0].intensity = 0
    lights[0].shadow.needsUpdate = true
    atlas.prepare(gl, scene, camera, focus, false, detail)
    expect(atlas.uniforms.casaPointShadowTiles.value.map((v) => v.toArray())).toEqual(tiles)
    expect([map.width, map.height]).toEqual(size)
    expect(lights.every((l) => !l.shadow.needsUpdate)).toBe(true)
    expect(gl.shadowMap.needsUpdate).toBe(false)

    // ShadowUpdates requests fresh occlusion when a dormant fixture becomes active again.
    lights[0].intensity = 1
    lights[0].shadow.needsUpdate = true
    atlas.prepare(gl, scene, camera, focus, false, detail)
    expect(atlas.uniforms.casaPointShadowTiles.value.map((v) => v.toArray())).toEqual(tiles)
    expect(lights[0].shadow.needsUpdate).toBe(true)
    expect(lights.slice(1).every((l) => !l.shadow.needsUpdate)).toBe(true)
    expect(gl.shadowMap.needsUpdate).toBe(true)
    for (const light of lights) light.intensity = 0
    gl.shadowMap.needsUpdate = false
    atlas.prepare(gl, scene, camera, focus, false, detail)
    expect(lights.every((l) => !l.shadow.needsUpdate)).toBe(true)
    expect(gl.shadowMap.needsUpdate).toBe(false)
    expect(gl.initRenderTarget).toHaveBeenLastCalledWith(map)
    atlas.dispose()
  })

  it.each([1, 0.5])('keeps faces stable while moving and reprioritises once settled (detail %s)', (detail) => {
    const scene = new Scene()
    const lights = Array.from({ length: 12 }, (_, i) => {
      const light = new PointLight()
      light.position.set(i * 2, 2.6, 0)
      light.castShadow = true
      scene.add(light)
      return light
    })
    const atlas = new PointShadowAtlas()
    const gl = {
      capabilities: { maxTextureSize: 4096 },
      shadowMap: { needsUpdate: false },
      initRenderTarget: vi.fn(),
    } as unknown as WebGLRenderer
    const camera = new PerspectiveCamera()
    atlas.prepare(gl, scene, camera, new Vector3(), false, detail)
    const tiles = atlas.uniforms.casaPointShadowTiles.value.map((v) => v.toArray())
    const detailed = lights[0].shadow.mapSize.x
    const distant = lights[11].shadow.mapSize.x
    const faces = lights.map((l) => l.shadow.getViewport(0))
    for (const light of lights) light.shadow.needsUpdate = false
    gl.shadowMap.needsUpdate = false

    const destination = new Vector3(22, 0, 0)
    atlas.prepare(gl, scene, camera, destination, true, detail)
    expect(atlas.uniforms.casaPointShadowTiles.value.map((v) => v.toArray())).toEqual(tiles)
    expect(lights.every((l, i) => l.shadow.getViewport(0) === faces[i])).toBe(true)
    expect(lights.every((l) => !l.shadow.needsUpdate)).toBe(true)
    expect(gl.shadowMap.needsUpdate).toBe(false)

    // A real light or geometry change still refreshes occlusion during movement.
    lights[0].shadow.needsUpdate = true
    atlas.prepare(gl, scene, camera, destination, true, detail)
    expect(lights[0].shadow.needsUpdate).toBe(true)
    expect(gl.shadowMap.needsUpdate).toBe(true)

    atlas.prepare(gl, scene, camera, destination, false, detail)
    expect(lights[11].shadow.mapSize.x).toBe(detailed)
    expect(lights[0].shadow.mapSize.x).toBe(distant)
    expect(atlas.uniforms.casaPointShadowTiles.value.map((v) => v.toArray())).not.toEqual(tiles)
    atlas.dispose()
  })
})

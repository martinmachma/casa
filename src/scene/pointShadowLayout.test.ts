import { describe, expect, it } from 'vitest'
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
    const gl = { capabilities: { maxTextureSize: 4096 }, shadowMap: { needsUpdate: false } } as WebGLRenderer
    atlas.prepare(gl, scene, new PerspectiveCamera(), new Vector3())
    const depth = new Vector3(0, 0, -2.6).applyMatrix4(light.shadow.camera.projectionMatrix).z * 0.5 + 0.5
    expect(depth).toBeCloseTo((9 * (2.6 - 0.1)) / (2.6 * (9 - 0.1)), 12)
    atlas.dispose()
  })
})

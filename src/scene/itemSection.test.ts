/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { itemSection } from './itemSection'

const material = new MeshStandardMaterial({ color: '#987654' })
const cast = (geometry: ReturnType<typeof itemSection>, x: number, z: number) => {
  const mesh = new Mesh(geometry, material)
  return new Raycaster(new Vector3(x, 10, z), new Vector3(0, -1, 0)).intersectObject(mesh)[0]
}

describe('furniture section geometry', () => {
  it('closes a transformed model with a flat upward-facing section at the cut height', () => {
    const mesh = new Mesh(new BoxGeometry(1, 2, 1), material)
    const matrix = new Matrix4()
      .makeRotationY(Math.PI / 4)
      .scale(new Vector3(2, 1, 0.5))
      .setPosition(3, 1, 4)
    const cap = itemSection([{ mesh, matrix }], 1.2)
    expect(cast(cap, 3, 4)?.point.y).toBeCloseTo(1.2)
    const position = cap.getAttribute('position')
    const normal = cap.getAttribute('normal')
    let area = 0
    for (let i = 0; i < position.count; i += 3) {
      const [a, b, c] = [i, i + 1, i + 2].map((j) => new Vector3().fromBufferAttribute(position, j))
      area += b.sub(a).cross(c.sub(a)).length() / 2
    }
    expect(area).toBeCloseTo(1)
    for (let i = 0; i < position.count; i++) {
      expect(position.getY(i)).toBeCloseTo(1.2)
      expect(normal.getY(i)).toBeCloseTo(1)
    }
    cap.dispose()
    mesh.geometry.dispose()
  })

  it('keeps the gap between separate panels open and makes no cap above the model', () => {
    const sources = [-1, 1].map((x) => ({
      mesh: new Mesh(new BoxGeometry(0.2, 2, 1), material),
      matrix: new Matrix4().makeTranslation(x, 1, 0),
    }))
    const cap = itemSection(sources, 1)
    expect(cast(cap, -1, 0)).toBeDefined()
    expect(cast(cap, 1, 0)).toBeDefined()
    expect(cast(cap, 0, 0)).toBeUndefined()
    const above = itemSection(sources, 3)
    expect(above.getAttribute('position').count).toBe(0)
    for (const { mesh } of sources) mesh.geometry.dispose()
    cap.dispose()
    above.dispose()
  })

  it('caps the actual wardrobe model without the old sloping interior triangles', async () => {
    const bytes = readFileSync(new URL('../../public/models/furniture/bookcaseClosedWide.glb', import.meta.url))
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
    const root = new Group()
    root.add(scene)
    root.scale.set(1, 2.2 / 0.79, 1)
    root.updateMatrixWorld(true)
    const sources: Parameters<typeof itemSection>[0] = []
    root.traverse((o) => {
      if (o instanceof Mesh) sources.push({ mesh: o, matrix: o.matrixWorld.clone() })
    })
    const cap = itemSection(sources, 1)
    expect(cap.getAttribute('position').count).toBeGreaterThan(0)
    expect(cast(cap, 0.01, -0.125)?.point.y).toBeCloseTo(1)
    for (let i = 0; i < cap.getAttribute('position').count; i++) {
      expect(cap.getAttribute('position').getY(i)).toBe(1)
    }
    for (const { mesh } of sources) mesh.geometry.dispose()
    cap.dispose()
  })
})

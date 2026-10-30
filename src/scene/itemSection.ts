import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  ShapeUtils,
  Vector2,
  Vector3,
  type Mesh,
} from 'three'

export type SectionSource = { mesh: Mesh; matrix: Matrix4 }
const PRECISION = 1e5
const DARKEN = 0.55

/** The actual horizontal section of the model, in item-local coordinates, with upward-facing triangles. */
export const itemSection = (sources: SectionSource[], height: number): BufferGeometry => {
  const positions: number[] = []
  const colors: number[] = []
  for (const { mesh, matrix } of sources) {
    const geometry = mesh.geometry
    const position = geometry.getAttribute('position')
    if (!position) continue
    const index = geometry.index
    const points = new Map<string, Vector2>()
    const edges = new Map<string, string[]>()
    const color = [mesh.material].flat().find((m) => m instanceof MeshStandardMaterial)?.color
    const tint = color ? color.toArray().map((c) => c * DARKEN) : [0.2, 0.2, 0.2]
    const key = (p: Vector2) => `${Math.round(p.x * PRECISION)},${Math.round(p.y * PRECISION)}`
    const add = (a: Vector2, b: Vector2) => {
      const ka = key(a),
        kb = key(b)
      if (ka === kb) return
      points.set(ka, a)
      points.set(kb, b)
      for (const [from, to] of [
        [ka, kb],
        [kb, ka],
      ]) {
        const neighbours = edges.get(from) ?? []
        if (!neighbours.includes(to)) neighbours.push(to)
        edges.set(from, neighbours)
      }
    }
    const count = index?.count ?? position.count
    for (let t = 0; t < count; t += 3) {
      const triangle = [0, 1, 2].map((i) =>
        new Vector3().fromBufferAttribute(position, index ? index.getX(t + i) : t + i).applyMatrix4(matrix),
      )
      const crossings: Vector2[] = []
      for (let i = 0; i < 3; i++) {
        const a = triangle[i],
          b = triangle[(i + 1) % 3]
        if (a.y < height === b.y < height) continue
        const k = (height - a.y) / (b.y - a.y)
        crossings.push(new Vector2(a.x + k * (b.x - a.x), a.z + k * (b.z - a.z)))
      }
      if (crossings.length === 2) add(crossings[0], crossings[1])
    }

    // Join the triangle intersections into closed outlines. Open meshes do not get an invented cap.
    const loops: Vector2[][] = []
    const used = new Set<string>()
    const edgeKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`)
    for (const [start, neighbours] of edges)
      for (const next of neighbours) {
        if (used.has(edgeKey(start, next))) continue
        const loop = [points.get(start)!]
        let previous = start,
          current = next
        used.add(edgeKey(previous, current))
        while (current !== start) {
          loop.push(points.get(current)!)
          const after = edges.get(current)?.find((n) => n !== previous && !used.has(edgeKey(current, n)))
          if (!after) break
          used.add(edgeKey(current, after))
          previous = current
          current = after
        }
        if (current === start && loop.length >= 3) loops.push(loop)
      }
    // Separate solid components are capped separately, so gaps between legs/panels remain open.
    for (const loop of loops) {
      for (const face of ShapeUtils.triangulateShape(loop, [])) {
        const vertices = face.map((i) => loop[i])
        if (ShapeUtils.area(vertices) > 0) vertices.reverse()
        for (const p of vertices) {
          positions.push(p.x, height, p.y)
          colors.push(...tint)
        }
      }
    }
  }
  const result = new BufferGeometry()
  result.setAttribute('position', new Float32BufferAttribute(positions, 3))
  result.setAttribute('color', new Float32BufferAttribute(colors, 3))
  result.computeVertexNormals()
  return result
}

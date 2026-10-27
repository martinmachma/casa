// Measures each furniture model's footprint seen from above, so L-shaped pieces (a sofa with a chaise, a corner
// desk) don't block the empty corner of their box. Writes src/furniture/footprints.json; rerun after adding models:
//   node scripts/footprints.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Box3, Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const DIR = 'public/models/furniture'
// The box is cut into this many cells each way; a cell at least half covered from above counts as solid.
const GRID = 12
const SAMPLES = 4

const load = (file) =>
  new Promise((resolve, reject) => {
    const buf = readFileSync(`${DIR}/${file}`)
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', resolve, reject)
  })

const inTriangle = (px, pz, a, b, c) => {
  const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (pz - b[1])
  const d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (pz - c[1])
  const d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (pz - a[1])
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

/** Solid cells merged greedily into rectangles, in the box's own -0.5…0.5 coordinates (x along width, z along depth). */
const rects = (solid) => {
  const used = solid.map((row) => row.map(() => false))
  const out = []
  for (let j = 0; j < GRID; j++)
    for (let i = 0; i < GRID; i++) {
      if (!solid[j][i] || used[j][i]) continue
      let w = 1
      while (i + w < GRID && solid[j][i + w] && !used[j][i + w]) w++
      let h = 1
      while (j + h < GRID && [...Array(w).keys()].every((k) => solid[j + h][i + k] && !used[j + h][i + k])) h++
      for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) used[y][x] = true
      const r = (n) => Math.round((n / GRID - 0.5) * 1000) / 1000
      out.push([r(i), r(i + w), r(j), r(j + h)])
    }
  return out
}

const result = {}
for (const file of readdirSync(DIR)
  .filter((f) => f.endsWith('.glb'))
  .sort()) {
  const gltf = await load(file)
  const scene = gltf.scene
  scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene)
  const size = box.getSize(new Vector3())
  const tris = []
  const v = new Vector3()
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return
    const pos = o.geometry.attributes.position
    const index = o.geometry.index
    const at = (k) => {
      v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld)
      return [(v.x - box.min.x) / size.x, (v.z - box.min.z) / size.z]
    }
    const n = index ? index.count : pos.count
    for (let t = 0; t < n; t += 3) {
      const k = (m) => (index ? index.getX(t + m) : t + m)
      tris.push([at(k(0)), at(k(1)), at(k(2))])
    }
  })
  const solid = []
  for (let j = 0; j < GRID; j++) {
    const row = []
    for (let i = 0; i < GRID; i++) {
      let hit = 0
      for (let sj = 0; sj < SAMPLES; sj++)
        for (let si = 0; si < SAMPLES; si++) {
          const px = (i + (si + 0.5) / SAMPLES) / GRID
          const pz = (j + (sj + 0.5) / SAMPLES) / GRID
          if (tris.some(([a, b, c]) => inTriangle(px, pz, a, b, c))) hit++
        }
      row.push(hit * 2 >= SAMPLES * SAMPLES)
    }
    solid.push(row)
  }
  const shape = rects(solid)
  // A full box needs no entry.
  if (!(shape.length === 1 && shape[0].join() === '-0.5,0.5,-0.5,0.5')) result[file.replace('.glb', '')] = shape
  console.log(file.padEnd(32), solid.map((r) => r.map((s) => (s ? '#' : '.')).join('')).join(' '))
}
writeFileSync('src/furniture/footprints.json', JSON.stringify(result, null, 2) + '\n')

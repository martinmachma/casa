import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// Floor finishes, drawn procedurally so they need no downloads and tile seamlessly. Each texture covers
// `tile` × `tile` metres of floor; the room floor mesh uses plan metres as UVs.

export type FloorMaterial = {
  id: string
  name: string
  group: 'Wood' | 'Tiles' | 'Carpet' | 'Other'
  /** Metres of floor one texture repeat covers. */
  tile: number
  roughness: number
  draw: (ctx: CanvasRenderingContext2D, px: number) => void
}

const SIZE = 512

/** Deterministic pseudo-random numbers, so a texture looks the same on every device. */
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)))
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`
}

/**
 * Staggered planks with grain. `rows` planks across the tile, each `ratio` times as long as wide; `knots` is the
 * chance a plank has a knot, for rustic boards.
 */
const planks =
  (base: string, rows: number, ratio: number, seed: number, knots = 0) =>
  (ctx: CanvasRenderingContext2D, px: number) => {
    const rnd = random(seed)
    const h = px / rows
    const w = h * ratio
    for (let r = 0; r < rows; r++) {
      const offset = ((r * 0.37) % 1) * w
      for (let x = -offset; x < px; x += w) {
        const tone = (rnd() - 0.5) * 0.07
        ctx.fillStyle = shade(base, tone)
        ctx.fillRect(x, r * h, w, h)
        ctx.strokeStyle = shade(base, tone - 0.06)
        ctx.lineWidth = 1
        for (let g = 0; g < 7; g++) {
          const y = r * h + rnd() * h
          ctx.globalAlpha = 0.35
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.bezierCurveTo(x + w * 0.3, y + (rnd() - 0.5) * 6, x + w * 0.7, y + (rnd() - 0.5) * 6, x + w, y)
          ctx.stroke()
        }
        if (rnd() < knots) {
          const kx = x + rnd() * w
          const ky = r * h + (0.2 + rnd() * 0.6) * h
          ctx.globalAlpha = 0.6
          ctx.fillStyle = shade(base, -0.25)
          ctx.beginPath()
          ctx.ellipse(kx, ky, 2 + rnd() * 4, 1.5 + rnd() * 2, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        ctx.fillStyle = shade(base, -0.15)
        ctx.fillRect(x, r * h, 1.5, h)
      }
      ctx.fillStyle = shade(base, -0.15)
      ctx.fillRect(0, r * h, px, 1.5)
    }
  }

/** Square tiles with grout; `count` tiles across the texture. */
const tiles =
  (base: string, grout: string, count: number, seed: number) => (ctx: CanvasRenderingContext2D, px: number) => {
    const rnd = random(seed)
    ctx.fillStyle = grout
    ctx.fillRect(0, 0, px, px)
    const s = px / count
    for (let i = 0; i < count; i++)
      for (let j = 0; j < count; j++) {
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.05)
        ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4)
      }
  }

/** Long tiles in a half bond with fine grout and a faint stone speckle; `cols` × `rows` tiles per texture. */
const slabs =
  (base: string, grout: string, cols: number, rows: number, seed: number) =>
  (ctx: CanvasRenderingContext2D, px: number) => {
    const rnd = random(seed)
    ctx.fillStyle = grout
    ctx.fillRect(0, 0, px, px)
    const w = px / cols
    const h = px / rows
    for (let r = 0; r < rows; r++)
      for (let c = -1; c < cols; c++) {
        const x = c * w + (r % 2 ? w / 2 : 0)
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.03)
        ctx.fillRect(x + 1, r * h + 1, w - 2, h - 2)
      }
    for (let k = 0; k < px * px * 0.05; k++) {
      ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.08)
      ctx.fillRect(rnd() * px, rnd() * px, 1, 1)
    }
  }

/** Fine fibre noise. */
const speckle = (base: string, strength: number, seed: number) => (ctx: CanvasRenderingContext2D, px: number) => {
  const rnd = random(seed)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, px, px)
  for (let k = 0; k < px * px * 0.18; k++) {
    ctx.fillStyle = shade(base, (rnd() - 0.5) * strength)
    ctx.fillRect(rnd() * px, rnd() * px, 1.5, 1.5)
  }
}

export const FLOOR_MATERIALS: FloorMaterial[] = [
  { id: 'oak', name: 'Oak', group: 'Wood', tile: 1.2, roughness: 0.6, draw: planks('#c9a173', 6, 6, 1) },
  { id: 'oak-light', name: 'Light oak', group: 'Wood', tile: 1.2, roughness: 0.6, draw: planks('#dcc29b', 6, 6, 2) },
  { id: 'walnut', name: 'Walnut', group: 'Wood', tile: 1.2, roughness: 0.55, draw: planks('#7a5638', 6, 6, 3) },
  { id: 'grey-oak', name: 'Grey oak', group: 'Wood', tile: 1.2, roughness: 0.65, draw: planks('#a69c8e', 6, 6, 4) },
  {
    id: 'tile-white',
    name: 'White tiles 60',
    group: 'Tiles',
    tile: 1.2,
    roughness: 0.3,
    draw: tiles('#eeebe6', '#cfcac2', 2, 5),
  },
  {
    id: 'tile-grey',
    name: 'Grey tiles 60',
    group: 'Tiles',
    tile: 1.2,
    roughness: 0.35,
    draw: tiles('#9c9a96', '#7f7c78', 2, 6),
  },
  {
    id: 'tile-anthracite',
    name: 'Anthracite 60',
    group: 'Tiles',
    tile: 1.2,
    roughness: 0.4,
    draw: tiles('#4a4a4a', '#3a3a3a', 2, 7),
  },
  {
    id: 'tile-terracotta',
    name: 'Terracotta 30',
    group: 'Tiles',
    tile: 1.2,
    roughness: 0.7,
    draw: tiles('#b8694a', '#d9cbb8', 4, 8),
  },
  {
    id: 'carpet-beige',
    name: 'Beige carpet',
    group: 'Carpet',
    tile: 0.5,
    roughness: 1,
    draw: speckle('#cdbb9f', 0.14, 9),
  },
  {
    id: 'carpet-grey',
    name: 'Grey carpet',
    group: 'Carpet',
    tile: 0.5,
    roughness: 1,
    draw: speckle('#8d8b88', 0.14, 10),
  },
  {
    id: 'carpet-blue',
    name: 'Blue carpet',
    group: 'Carpet',
    tile: 0.5,
    roughness: 1,
    draw: speckle('#5d6f86', 0.14, 11),
  },
  { id: 'concrete', name: 'Concrete', group: 'Other', tile: 2, roughness: 0.8, draw: speckle('#b3b0aa', 0.05, 12) },
]

// The house's actual floors, which can't be changed in the app.
const OAK_NATURAL: FloorMaterial = {
  id: 'oak-natural',
  name: 'Natural oak',
  group: 'Wood',
  tile: 1.2,
  roughness: 0.6,
  draw: planks('#b38b66', 6, 6, 13),
}
const OAK_RUSTIC: FloorMaterial = {
  id: 'oak-rustic',
  name: 'Rustic light oak',
  group: 'Wood',
  tile: 1.2,
  roughness: 0.65,
  draw: planks('#cdbea5', 6, 6, 14, 0.5),
}
// Spark Perla, 30 × 90 cm, matt.
const SPARK_PERLA: FloorMaterial = {
  id: 'spark-perla',
  name: 'Spark Perla 30 × 90',
  group: 'Tiles',
  tile: 1.8,
  roughness: 0.75,
  draw: slabs('#cfccc6', '#bdb9b2', 2, 6, 15),
}

/** Fixed floors by layout room id. Rooms left out (the bathrooms, for now) keep the finish picked for them. */
export const FIXED_FLOORS: Record<string, FloorMaterial> = {
  'g-living': OAK_NATURAL,
  'u-hall': OAK_NATURAL,
  'u-room-203': OAK_RUSTIC,
  'u-bedroom': OAK_RUSTIC,
  'u-room-205': OAK_RUSTIC,
  'g-hall': SPARK_PERLA,
  'g-storage': SPARK_PERLA,
  'u-storage': SPARK_PERLA,
}

export const floorMaterial = (id: string | undefined) => FLOOR_MATERIALS.find((m) => m.id === id)

/** A room's floor: its fixed one, else the picked finish `saved`. */
export const roomFloor = (roomId: string, saved: string | undefined) => FIXED_FLOORS[roomId] ?? floorMaterial(saved)

const canvases = new Map<string, HTMLCanvasElement>()
const textures = new Map<string, CanvasTexture>()

const canvasFor = (m: FloorMaterial) => {
  let canvas = canvases.get(m.id)
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    m.draw(canvas.getContext('2d')!, SIZE)
    canvases.set(m.id, canvas)
  }
  return canvas
}

/** The shared texture of a material, repeating once per `tile` metres. */
export const floorTexture = (m: FloorMaterial): CanvasTexture => {
  let texture = textures.get(m.id)
  if (!texture) {
    texture = new CanvasTexture(canvasFor(m))
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(1 / m.tile, 1 / m.tile)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    textures.set(m.id, texture)
  }
  return texture
}

const previews = new Map<string, string>()

/** A small image of about 60 cm of the floor, for swatches. */
export const floorPreview = (m: FloorMaterial): string => {
  let url = previews.get(m.id)
  if (!url) {
    const small = document.createElement('canvas')
    small.width = small.height = 96
    const part = SIZE * Math.min(1, 0.6 / m.tile)
    small.getContext('2d')!.drawImage(canvasFor(m), 0, 0, part, part, 0, 0, 96, 96)
    url = small.toDataURL('image/png')
    previews.set(m.id, url)
  }
  return url
}

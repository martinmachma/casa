import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// The house's actual floors, drawn procedurally so they need no downloads and tile seamlessly. Each texture
// covers `tile` × `tile` metres of floor; the room floor mesh uses plan metres as UVs.

export type FloorMaterial = {
  /** Metres of floor one texture repeat covers. */
  tile: number
  /** Texture pixels across. */
  size: number
  roughness: number
  /** Draws the texture, or with `bump` its bump map in greys, from the same layout. */
  draw: (ctx: CanvasRenderingContext2D, px: number, bump: boolean) => void
  /** How strongly its joints and grain catch the light. */
  bumpScale: number
}

/** Deterministic pseudo-random numbers, so a texture looks the same on every device. */
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const shade = (hex: string, amount: number, alpha = 1) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)))
  return `rgba(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)}, ${alpha})`
}

/** A grey for bump maps: mid grey is the surface, `tone` raises (+) or sinks (−) it. */
const grey = (tone: number, alpha = 1) => {
  const v = Math.max(0, Math.min(255, Math.round(128 + tone * 255)))
  return `rgba(${v}, ${v}, ${v}, ${alpha})`
}

/** Shifts every pixel's brightness by up to ±`amount`, for a fine surface noise. */
const noise = (ctx: CanvasRenderingContext2D, px: number, amount: number, seed: number) => {
  const rnd = random(seed)
  const image = ctx.getImageData(0, 0, px, px)
  const d = image.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 2 * amount * 255
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(image, 0, 0)
}

type WoodOptions = {
  base: string
  /** Metres one texture repeat covers. */
  tile: number
  /** Board width and the range of board lengths, metres. */
  width: number
  length: [number, number]
  /** How much boards differ in tone. */
  spread: number
  /** Chance a board shows flat-sawn arches. */
  arches: number
  /** Chance a board has a crack along its grain, for rustic oak. */
  cracks: number
  seed: number
}

/**
 * Wide oak boards of random lengths in staggered rows: lengthwise streaks, fine grain, flat-sawn arches on some
 * boards, and cracks on rustic ones. A board running off the right edge carries on from the left, so
 * the texture tiles.
 */
const wood = (o: WoodOptions) => (ctx: CanvasRenderingContext2D, px: number, bump: boolean) => {
  const rnd = random(o.seed)
  const m = px / o.tile
  const u = px / 2048
  // Grain is only faintly raised; the joints between boards are grooves.
  const paint = (tone: number) => (bump ? grey(tone * 0.5) : shade(o.base, tone))

  const board = (x: number, y: number, w: number, h: number, seed: number) => {
    const r = random(seed)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    const tone = (r() - 0.5) * o.spread
    ctx.fillStyle = bump ? grey(0) : shade(o.base, tone)
    ctx.fillRect(x, y, w, h)

    // Broad lengthwise streaks of lighter and darker wood.
    for (let k = 0; k < 7; k++) {
      ctx.globalAlpha = 0.12 + r() * 0.15
      ctx.fillStyle = paint(tone + (r() - 0.5) * 0.1)
      ctx.fillRect(x, y + r() * h, w, h * (0.05 + r() * 0.25))
    }

    // Fine grain: long, gently wavering lines.
    const lines = Math.round(h / (2.5 * u))
    for (let k = 0; k < lines; k++) {
      const y0 = y + r() * h
      const amp = (0.5 + r() * 2.5) * u
      const freq = (0.5 + r() * 2) / m
      const phase = r() * Math.PI * 2
      const drift = (r() - 0.5) * 6 * u
      const light = r() < 0.2
      ctx.globalAlpha = 0.1 + r() * 0.3
      ctx.strokeStyle = paint(light ? tone + 0.05 : tone - 0.04 - r() * 0.14)
      ctx.lineWidth = (0.6 + r() * 2) * u
      ctx.beginPath()
      for (let s = 0; s <= 24; s++) {
        const t = s / 24
        const yy = y0 + Math.sin(t * w * freq * Math.PI * 2 + phase) * amp + drift * t
        if (s) ctx.lineTo(x + t * w, yy)
        else ctx.moveTo(x, yy)
      }
      ctx.stroke()
    }

    // Flat-sawn arches, nested round a heart somewhere along the board.
    if (r() < o.arches) {
      const cx = x + r() * w
      const cy = y + (0.3 + r() * 0.4) * h
      const stretch = 4 + r() * 6
      const tilt = (r() - 0.5) * 0.06
      ctx.strokeStyle = paint(tone - 0.13)
      for (let k = 1; k <= 10; k++) {
        const ry = k * h * 0.065 * (0.85 + r() * 0.3)
        ctx.globalAlpha = 0.45 - k * 0.03
        ctx.lineWidth = (1.2 + r() * 2) * u
        ctx.beginPath()
        ctx.ellipse(cx + k * ry * 0.8, cy, ry * stretch, ry, tilt, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Cracks: thin, dark and ragged, along the grain.
    if (r() < o.cracks) {
      let cx = x + r() * w
      let cy = y + (0.15 + r() * 0.7) * h
      const steps = 6 + Math.round(r() * 10)
      ctx.globalAlpha = 0.7
      ctx.strokeStyle = paint(tone - 0.4)
      ctx.lineWidth = (0.8 + r()) * u
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      for (let s = 0; s < steps; s++) {
        cx += (0.008 + r() * 0.012) * m
        cy += (r() - 0.5) * 2 * u
        ctx.lineTo(cx, cy)
      }
      ctx.stroke()
    }

    // The joints, as a dark groove along the top and left edges.
    ctx.globalAlpha = bump ? 1 : 0.55
    ctx.fillStyle = bump ? grey(-0.45) : shade(o.base, tone - 0.25)
    ctx.fillRect(x, y, w, 1.5 * u)
    ctx.fillRect(x, y, 1.5 * u, h)
    ctx.restore()
  }

  const rows = Math.round(o.tile / o.width)
  const h = px / rows
  const [shortest, longest] = o.length.map((l) => l * m)
  for (let row = 0; row < rows; row++) {
    let x = rnd() * px
    const end = x + px
    while (x < end - 1) {
      let len = Math.min(shortest + rnd() * (longest - shortest), end - x)
      // A last piece too short to look like a board joins the one before it.
      if (end - x - len < shortest / 2) len = end - x
      const seed = Math.floor(rnd() * 1e9)
      board(x, row * h, len, h, seed)
      board(x - px, row * h, len, h, seed)
      x += len
    }
  }
  if (!bump) noise(ctx, px, 0.015, o.seed + 1)
}

type StoneOptions = {
  base: string
  grout: string
  /** Metres one texture repeat covers; a whole number of tiles each way. */
  tile: number
  /** Tile size and grout width, metres. */
  width: number
  height: number
  joint: number
  seed: number
}

/** Stone-look tiles laid in a grid: soft clouding, fine speckle, narrow grout. */
const stone = (o: StoneOptions) => (ctx: CanvasRenderingContext2D, px: number, bump: boolean) => {
  const m = px / o.tile
  const u = px / 2048
  const cols = Math.round(o.tile / o.width)
  const rows = Math.round(o.tile / o.height)
  const w = px / cols
  const h = px / rows
  const j = o.joint * m

  ctx.fillStyle = bump ? grey(-0.35) : o.grout
  ctx.fillRect(0, 0, px, px)
  for (let row = 0; row < rows; row++)
    for (let c = 0; c < cols; c++) {
      const r = random(o.seed + row * 101 + c * 7)
      const x = c * w
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + j / 2, row * h + j / 2, w - j, h - j)
      ctx.clip()
      const tone = (r() - 0.5) * 0.03
      ctx.fillStyle = bump ? grey(0) : shade(o.base, tone)
      ctx.fillRect(x, row * h, w, h)
      // Clouding.
      for (let k = 0; k < 30; k++) {
        const bx = x + r() * w
        const by = row * h + r() * h
        const br = (0.03 + r() * 0.15) * m
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br)
        const t = tone + (r() - 0.5) * 0.06
        g.addColorStop(0, bump ? grey(t * 0.1) : shade(o.base, t))
        g.addColorStop(1, bump ? grey(t * 0.1, 0) : shade(o.base, t, 0))
        ctx.globalAlpha = 0.2 + r() * 0.3
        ctx.fillStyle = g
        ctx.fillRect(bx - br, by - br, br * 2, br * 2)
      }
      // Speckle: mostly small, a few larger darker grains.
      const grains = Math.round((w * h) / (u * u * 60))
      for (let k = 0; k < grains; k++) {
        const big = r() < 0.06
        const t = big ? -0.12 - r() * 0.1 : (r() - 0.5) * 0.14
        ctx.globalAlpha = big ? 0.6 : 0.35
        ctx.fillStyle = bump ? grey(t * 0.15) : shade(o.base, t)
        const size = (big ? 2 + r() * 3 : 0.8 + r() * 1.5) * u
        ctx.fillRect(x + r() * w, row * h + r() * h, size, size)
      }
      ctx.restore()
    }
  if (!bump) noise(ctx, px, 0.012, o.seed + 1)
}

// Natural oak, in the living room, on the landing and the stairs.
const OAK_NATURAL: FloorMaterial = {
  tile: 2.4,
  size: 2048,
  roughness: 0.6,
  bumpScale: 1,
  draw: wood({
    base: '#a2876c',
    tile: 2.4,
    width: 0.2,
    length: [0.9, 1.5],
    spread: 0.07,
    arches: 0.35,
    cracks: 0,
    seed: 13,
  }),
}
// Rustic light oak, in the bedrooms upstairs.
const OAK_RUSTIC: FloorMaterial = {
  tile: 2.4,
  size: 2048,
  roughness: 0.65,
  bumpScale: 1,
  draw: wood({
    base: '#cdbea5',
    tile: 2.4,
    width: 0.2,
    length: [0.9, 1.5],
    spread: 0.09,
    arches: 0.55,
    cracks: 0.35,
    seed: 14,
  }),
}
// Spark Perla 60 × 60 cm, matt, rectified, in the hall and storage rooms.
const SPARK_PERLA: FloorMaterial = {
  tile: 1.8,
  size: 2048,
  roughness: 0.8,
  bumpScale: 1,
  draw: stone({
    base: '#cfccc6',
    grout: '#b9b5ae',
    tile: 1.8,
    width: 0.6,
    height: 0.6,
    joint: 0.002,
    seed: 15,
  }),
}

/** Floors by layout room id. Rooms left out (the bathrooms, for now) show the bare slab. */
const ROOM_FLOORS: Record<string, FloorMaterial | undefined> = {
  'g-living': OAK_NATURAL,
  'u-hall': OAK_NATURAL,
  'u-room-203': OAK_RUSTIC,
  'u-bedroom': OAK_RUSTIC,
  'u-room-205': OAK_RUSTIC,
  'g-hall': SPARK_PERLA,
  'g-storage': SPARK_PERLA,
  'u-storage': SPARK_PERLA,
}

export const roomFloor = (roomId: string) => ROOM_FLOORS[roomId]

/** The stairs are in the living room's oak. */
export const STAIR_FLOOR = OAK_NATURAL

// Drawn once per material, colour and bump map apart.
const textures = new Map<FloorMaterial, CanvasTexture>()
const bumpTextures = new Map<FloorMaterial, CanvasTexture>()

const textureFor = (m: FloorMaterial, bump: boolean) => {
  const cache = bump ? bumpTextures : textures
  let texture = cache.get(m)
  if (!texture) {
    // Bump maps are coarser: they only need to carry the joints and a hint of the grain.
    const px = m.size / (bump ? 2 : 1)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = px
    m.draw(canvas.getContext('2d', { willReadFrequently: true })!, px, bump)
    texture = new CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(1 / m.tile, 1 / m.tile)
    if (!bump) texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    cache.set(m, texture)
  }
  return texture
}

/** The shared texture of a material, repeating once per `tile` metres. */
export const floorTexture = (m: FloorMaterial): CanvasTexture => textureFor(m, false)

/** The shared bump map of a material. */
export const floorBump = (m: FloorMaterial): CanvasTexture => textureFor(m, true)

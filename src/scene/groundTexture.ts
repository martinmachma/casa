import { CanvasTexture, SRGBColorSpace } from 'three'

const SIZE = 1024
const BASE = '#e6e3d6'
// Muted gardens, roofs and paving, like an out-of-focus aerial photo.
const PATCHES = ['#a3b285', '#94a67b', '#b2bf94', '#a3b285', '#c4a594', '#aaa49e', '#f1ece2']
const STREET = '#ebe5da'

/** A small seeded random, so the neighbourhood looks the same on every load. */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const smoothstep = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Soft blurred surroundings, painted once onto a canvas: a neutral ground that fades out to the
 * sky at the rim, with blurry patches of gardens and roofs that stay clear of the plot in the middle.
 */
export const surroundingsTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const half = SIZE / 2
  const next = random(7)

  const base = ctx.createRadialGradient(half, half, 0, half, half, half)
  base.addColorStop(0, BASE)
  base.addColorStop(0.35, BASE)
  base.addColorStop(1, `${BASE}00`)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, SIZE, SIZE)
  // Everything after this only tints the ground already there, so it fades out with it.
  ctx.globalCompositeOperation = 'source-atop'

  // A few pale streets, stroked wide and faint several times so their edges blur.
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const angle = next() * Math.PI
    const offset = (next() - 0.5) * SIZE * 0.7
    const dx = Math.cos(angle) * SIZE
    const dy = Math.sin(angle) * SIZE
    const ox = half - Math.sin(angle) * offset
    const oy = half + Math.cos(angle) * offset
    if (Math.hypot(ox - half, oy - half) < SIZE * 0.12) continue
    for (let w = 40; w > 8; w -= 8) {
      ctx.strokeStyle = STREET
      ctx.globalAlpha = 0.12
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(ox - dx, oy - dy)
      ctx.lineTo(ox + dx, oy + dy)
      ctx.stroke()
    }
  }

  // Blurry patches: soft ellipses fading to nothing, sparser near the plot.
  for (let i = 0; i < 1100; i++) {
    const x = next() * SIZE
    const y = next() * SIZE
    const distance = Math.hypot(x - half, y - half) / half
    const alpha = 0.75 * smoothstep(distance, 0.08, 0.22)
    if (alpha <= 0) continue
    const radius = 10 + next() * 36
    const color = PATCHES[Math.floor(next() * PATCHES.length)]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(next() * Math.PI)
    ctx.scale(1, 0.5 + next() * 0.6)
    const blob = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    blob.addColorStop(0, color)
    blob.addColorStop(1, `${color}00`)
    ctx.globalAlpha = alpha * (0.5 + next() * 0.5)
    ctx.fillStyle = blob
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
    ctx.restore()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

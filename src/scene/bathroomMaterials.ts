import type { FloorMaterial } from './floorMaterials'

const random = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}

/** White marble with restrained grey and honey veins, on 120 × 60 cm slabs. */
export const BATHROOM_MARBLE: FloorMaterial = {
  tile: 1.2,
  size: 1024,
  roughness: 0.28,
  bumpScale: 0.0005,
  draw: (ctx, px, bump) => {
    ctx.fillStyle = bump ? '#808080' : '#f1f0ec'
    ctx.fillRect(0, 0, px, px)
    if (!bump) {
      const rnd = random(89)
      for (let row = 0; row < 2; row++) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, (row * px) / 2, px, px / 2)
        ctx.clip()
        for (let i = 0; i < 4; i++) {
          const y = (row * px) / 2 + (rnd() * px) / 2
          const slope = (rnd() - 0.5) * px * 2.2
          const gold = i % 3 === 0
          const points = Array.from({ length: 25 }, (_, j) => {
            const x = (j * px) / 24
            return [x, y + (slope * j) / 24 + Math.sin(j * 0.42 + i) * px * 0.018 + (rnd() - 0.5) * px * 0.012]
          })
          for (const [width, alpha] of [
            [14, 0.045],
            [4, 0.12],
            [1.2, 0.24],
          ]) {
            ctx.beginPath()
            points.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
            ctx.strokeStyle = gold ? `rgba(166, 130, 66, ${alpha})` : `rgba(126, 128, 124, ${alpha})`
            ctx.lineWidth = (width * px) / 1024
            ctx.stroke()
          }
        }
        ctx.restore()
      }
    }
    ctx.fillStyle = bump ? '#606060' : '#d5d0c7'
    const joint = (px * 0.0015) / 1.2
    ctx.fillRect(0, 0, px, joint)
    ctx.fillRect(0, px / 2, px, joint)
    ctx.fillRect(0, 0, joint, px)
  },
}

/** Warm, vein-cut stone on the shower's east wall, laid vertically as in the references. */
export const BATHROOM_TRAVERTINE: FloorMaterial = {
  tile: 1.2,
  size: 1024,
  roughness: 0.65,
  bumpScale: 0.001,
  draw: (ctx, px, bump) => {
    const rnd = random(132)
    ctx.fillStyle = bump ? '#808080' : '#cfbd9e'
    ctx.fillRect(0, 0, px, px)
    for (let i = 0; i < 650; i++) {
      const x = rnd() * px
      const y = rnd() * px
      const w = (0.001 + rnd() * 0.016) * px
      const h = (0.02 + rnd() * 0.4) * px
      ctx.fillStyle = bump
        ? `rgba(75,75,75,${rnd() * 0.1})`
        : i % 3
          ? `rgba(133,104,66,${rnd() * 0.13})`
          : `rgba(255,247,221,${rnd() * 0.3})`
      ctx.fillRect(x, y, w, h)
    }
    ctx.fillStyle = bump ? '#606060' : '#b6a68e'
    const joint = (px * 0.002) / 1.2
    ctx.fillRect(0, 0, joint, px)
    ctx.fillRect(px / 2, 0, joint, px)
    ctx.fillRect(0, 0, px, joint)
  },
}

/** Vertical walnut grain for the floating two-drawer vanity. */
export const BATHROOM_WOOD: FloorMaterial = {
  tile: 1,
  size: 512,
  roughness: 0.55,
  bumpScale: 0.0005,
  draw: (ctx, px, bump) => {
    const rnd = random(217)
    ctx.fillStyle = bump ? '#808080' : '#8d6849'
    ctx.fillRect(0, 0, px, px)
    for (let i = 0; i < 450; i++) {
      const x = rnd() * px
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.bezierCurveTo(x + px * 0.007, px * 0.3, x - px * 0.007, px * 0.7, x, px)
      ctx.strokeStyle = bump
        ? 'rgba(90,90,90,0.12)'
        : i % 3
          ? `rgba(46,27,15,${rnd() * 0.3})`
          : `rgba(220,184,131,${rnd() * 0.35})`
      ctx.lineWidth = (0.001 + rnd() * 0.002) * px
      ctx.stroke()
    }
  },
}

import type { FloorMaterial } from './floorMaterials'

const random = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}

/** Mixed, distressed grey stone squares, with occasional ribbed relief, in a staggered 20 cm grid. */
export const WC_STONE: FloorMaterial = {
  tile: 1.2,
  size: 1024,
  roughness: 0.86,
  bumpScale: 0.0015,
  draw: (ctx, px, bump) => {
    const rnd = random(410)
    const step = px / 6
    const joint = (px * 0.0015) / 1.2
    ctx.fillStyle = bump ? '#606060' : '#9e9e96'
    ctx.fillRect(0, 0, px, px)
    for (let row = 0; row < 6; row++)
      for (let col = -1; col < 6; col++) {
        const x = (col + (row % 2) / 2) * step
        const y = row * step
        // The clipped edge tiles use the same seed at either end, keeping the repeat seamless.
        const r = random(513 + row * 71 + ((col + 6) % 6) * 101)
        const tone = Math.round(172 + r() * 23)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x + joint / 2, y + joint / 2, step - joint, step - joint)
        ctx.clip()
        ctx.fillStyle = bump ? '#808080' : `rgb(${tone + 2},${tone + 2},${tone - 2})`
        ctx.fillRect(x, y, step, step)
        for (let i = 0; i < 45; i++) {
          const cx = x + r() * step
          const cy = y + r() * step
          const radius = (0.03 + r() * 0.35) * step
          const light = r() > 0.5
          const color = light ? '238,237,228' : '95,98,93'
          const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
          gradient.addColorStop(0, bump ? `rgba(110,110,110,0.16)` : `rgba(${color},0.28)`)
          gradient.addColorStop(1, bump ? 'rgba(110,110,110,0)' : `rgba(${color},0)`)
          ctx.fillStyle = gradient
          ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
        }
        const pattern = Math.floor(r() * 5)
        for (let i = 0; i < 50; i++) {
          const a = r() * step
          const b = r() * step
          ctx.beginPath()
          if (pattern === 0) {
            // Closely spaced vertical grooves on some of the stone squares.
            ctx.moveTo(x + (i * step) / 50, y)
            ctx.lineTo(x + (i * step) / 50, y + step)
          } else if (pattern === 1) {
            ctx.moveTo(x, y + (i * step) / 50)
            ctx.lineTo(x + step, y + (i * step) / 50)
          } else {
            ctx.moveTo(x + a, y + b)
            ctx.bezierCurveTo(
              x + a + step * 0.12,
              y + b - step * 0.1,
              x + a - step * 0.1,
              y + b - step * 0.22,
              x + a + step * 0.06,
              y + b - step * 0.36,
            )
          }
          ctx.strokeStyle = bump ? 'rgba(65,65,65,0.22)' : 'rgba(95,98,91,0.18)'
          ctx.lineWidth = step * (pattern < 2 ? 0.008 : 0.012)
          ctx.stroke()
        }
        ctx.restore()
      }
    const image = ctx.getImageData(0, 0, px, px)
    for (let i = 0; i < image.data.length; i += 4) {
      const grain = (rnd() - 0.5) * (bump ? 18 : 10)
      for (let channel = 0; channel < 3; channel++) image.data[i + channel] += grain
    }
    ctx.putImageData(image, 0, 0)
  },
}

export type ShadowTile = { x: number; y: number; size: number }

/** Six cube faces per bulb, packed in rows. Reduce detail, never the number of illuminated rooms. */
export const pointShadowLayout = (sizes: number[], limit: number) => {
  let detail = sizes.map((s) => Math.min(s, 2 ** Math.floor(Math.log2(limit / 3))))
  for (;;) {
    const order = detail.map((size, index) => ({ size, index })).sort((a, b) => b.size - a.size || a.index - b.index)
    const area = detail.reduce((sum, s) => sum + 6 * s * s, 0)
    const width = Math.min(limit, Math.max(1, ...detail.map((s) => 3 * s), Math.ceil(Math.sqrt(area) / 128) * 128))
    const tiles: ShadowTile[] = []
    let x = 0,
      y = 0,
      row = 0
    for (const { size, index } of order) {
      if (x + 3 * size > width) {
        y += row
        x = row = 0
      }
      tiles[index] = { x, y, size }
      x += 3 * size
      row = Math.max(row, 2 * size)
    }
    const height = Math.max(1, y + row)
    if (height <= limit) return { width, height, tiles }
    // Real scenes reach this well before a 1-pixel face. An impossible allocation must fail explicitly.
    if (detail.every((s) => s === 1)) throw new Error('Too many point lights for the shadow atlas')
    detail = detail.map((s) => Math.max(1, s / 2))
  }
}

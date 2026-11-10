// Cuts the app icons out of the logo illustration (brand/nest-logo-source.png): the shiba asleep in its nest,
// framed so the nest fills the square. Rerun after changing the logo:
//   npm run icons
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const SOURCE = 'brand/nest-logo-source.png'
const OUT = 'public'

// The square around the nest, as a multiple of the nest's width. Maskable icons get cropped to a circle by the
// launcher, so the nest has to sit inside its middle 80%.
const PLAIN = 1.08
const MASKABLE = 1.3
// The illustration's background.
const CREAM = { r: 254, g: 242, b: 228 }

const { info: bounds } = await sharp(SOURCE).trim({ threshold: 40 }).toBuffer({ resolveWithObject: true })
const left = -bounds.trimOffsetLeft
const top = -bounds.trimOffsetTop
const centreX = left + bounds.width / 2
const centreY = top + bounds.height / 2

const square = async (scale, size) => {
  const side = Math.round(bounds.width * scale)
  const pad = side // Room on every side so the square never runs off the picture, in the picture's cream.
  const padded = await sharp(SOURCE)
    .removeAlpha()
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: CREAM })
    .toBuffer()
  return sharp(padded)
    .extract({
      left: Math.round(centreX + pad - side / 2),
      top: Math.round(centreY + pad - side / 2),
      width: side,
      height: side,
    })
    .resize(size, size)
    .png()
    .toBuffer()
}

for (const size of [64, 192, 512]) writeFileSync(`${OUT}/pwa-${size}x${size}.png`, await square(PLAIN, size))
writeFileSync(`${OUT}/apple-touch-icon-180x180.png`, await square(PLAIN, 180))
writeFileSync(`${OUT}/maskable-icon-512x512.png`, await square(MASKABLE, 512))

// favicon.ico holding one 48 px PNG, which every current browser reads.
const png = await square(PLAIN, 48)
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // one image
header.writeUInt8(48, 6)
header.writeUInt8(48, 7)
header.writeUInt16LE(1, 10) // colour planes
header.writeUInt16LE(32, 12) // bits per pixel
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18) // image data starts after this header
writeFileSync(`${OUT}/favicon.ico`, Buffer.concat([header, png]))

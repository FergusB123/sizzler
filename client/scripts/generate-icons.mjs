// Rasterise the Sizzler brand mark (skillet + flame) into PWA icon sizes,
// composited onto Warm Cream. Run with: npm run icons (requires sharp).
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '../public')
const iconsDir = resolve(pub, 'icons')
const mark = resolve(pub, 'brand/sizzler-mark.png')
const markDark = resolve(pub, 'brand/sizzler-mark-ondark.png')

const cream = { r: 251, g: 245, b: 236, alpha: 1 } // #FBF5EC
const charcoal = { r: 27, g: 25, b: 22, alpha: 1 } // #1B1916

async function render(size, bg, src, pad, out) {
  const inner = Math.round(size * (1 - pad * 2))
  const logo = await sharp(src).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(resolve(iconsDir, out))
  console.log('wrote', out)
}

await render(192, cream, mark, 0.14, 'icon-192.png')
await render(512, cream, mark, 0.14, 'icon-512.png')
// Maskable: charcoal field + on-dark mark with generous safe-zone padding.
await render(512, charcoal, markDark, 0.22, 'icon-maskable-512.png')
console.log('done')

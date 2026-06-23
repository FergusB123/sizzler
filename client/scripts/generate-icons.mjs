// Rasterise the brand SVG into the PNG sizes the manifest needs.
// Run with: npm run icons   (requires the `sharp` devDependency)
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = resolve(here, '../public/icons')
const cream = '#fbf5ec'
const ink = '#0f0d0c'

const logo = readFileSync(resolve(iconsDir, 'flame.svg'))

async function render(size, bg, pad, out) {
  const inner = Math.round(size * (1 - pad * 2))
  const logoPng = await sharp(logo).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logoPng, gravity: 'center' }])
    .png()
    .toFile(resolve(iconsDir, out))
  console.log('wrote', out)
}

await render(192, cream, 0.12, 'icon-192.png')
await render(512, cream, 0.12, 'icon-512.png')
// Maskable needs safe-zone padding and ink background for contrast on any shape.
await render(512, ink, 0.2, 'icon-maskable-512.png')
console.log('done')

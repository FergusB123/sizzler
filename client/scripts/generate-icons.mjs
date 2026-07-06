// Rasterise the Sizzler brand mark (skillet + flame) into PWA icon sizes on a
// modern dark field with a warm ember glow behind it. Run: npm run icons.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '../public')
const iconsDir = resolve(pub, 'icons')
const markDark = resolve(pub, 'brand/sizzler-mark-ondark.png')

// Charcoal base + a warm radial glow sitting behind the flame.
function bg(size) {
  return Buffer.from(
`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
  <defs>
    <linearGradient id='base' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#241f1a'/>
      <stop offset='1' stop-color='#141210'/>
    </linearGradient>
    <radialGradient id='glow' cx='50%' cy='40%' r='58%'>
      <stop offset='0%' stop-color='#eb4606' stop-opacity='0.60'/>
      <stop offset='55%' stop-color='#eb4606' stop-opacity='0.12'/>
      <stop offset='100%' stop-color='#eb4606' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='${size}' height='${size}' fill='url(#base)'/>
  <rect width='${size}' height='${size}' fill='url(#glow)'/>
</svg>`)
}

async function render(size, pad, out) {
  const inner = Math.round(size * (1 - pad * 2))
  const logo = await sharp(markDark)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()
  await sharp(bg(size))
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(resolve(iconsDir, out))
  console.log('wrote', out)
}

await render(192, 0.16, 'icon-192.png')
await render(512, 0.16, 'icon-512.png')
// Maskable: extra safe-zone so nothing important is cropped by the OS mask.
await render(512, 0.26, 'icon-maskable-512.png')
console.log('done')

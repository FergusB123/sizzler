// Recipe image generation.
// ── INTEGRATION POINT ──────────────────────────────────────────────
// Default returns an on-brand deterministic SVG "food card" (data URL) so the
// app works with no image-gen key. To use a real generator, set
// IMAGE_GEN_PROVIDER + IMAGE_GEN_API_KEY and implement realProvider() — it is
// the only function you need to change.
// ───────────────────────────────────────────────────────────────────
const PROVIDER = process.env.IMAGE_GEN_PROVIDER || 'stub';
// When no real provider is configured we skip persisting an image entirely, so
// the client renders its elegant typographic fallback instead of a stub.
const imageGenEnabled = PROVIDER !== 'stub';

const PALETTES = [
  ['#1c1c33', '#101015'], ['#112a26', '#101015'], ['#2a1a30', '#101015'],
  ['#2a2418', '#101015'], ['#1a2230', '#101015'], ['#221a2e', '#101015'],
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function placeholderCard(title) {
  const [a, b] = PALETTES[hash(title || 'Recipe') % PALETTES.length];
  const safe = (title || 'Recipe').slice(0, 40).replace(/[<&>]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/>
    </linearGradient></defs>
    <rect width='800' height='600' fill='url(#g)'/>
    <g fill='#fff' opacity='0.18'><circle cx='640' cy='130' r='90'/><circle cx='160' cy='480' r='120'/></g>
    <text x='400' y='300' font-family='Georgia, serif' font-size='220' text-anchor='middle' fill='#fff' opacity='0.92'>&#127858;</text>
    <text x='400' y='430' font-family='Georgia, serif' font-size='40' font-weight='600' text-anchor='middle' fill='#fff'>${safe}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Replace this body to call a real text-to-image API and return an image URL.
async function realProvider(_prompt) {
  // e.g. OpenAI Images / Replicate — return a URL string, or null to fall back.
  return null;
}

async function generateRecipeImage(title, description) {
  if (PROVIDER !== 'stub') {
    try {
      const url = await realProvider(description || title);
      if (url) return { url, generated: true };
    } catch { /* fall through to placeholder */ }
  }
  return { url: placeholderCard(title), generated: true, placeholder: true };
}

module.exports = { generateRecipeImage, imageGenEnabled };

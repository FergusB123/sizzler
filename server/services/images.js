// Recipe image generation.
// ── Provider ────────────────────────────────────────────────────────
// Uses Google Gemini's image model ("nano banana", gemini-2.5-flash-image)
// when GEMINI_API_KEY is set — producing photoreal, recipe-site-style food
// shots. With no key we fall back to an on-brand typographic card so the app
// still works everywhere.
// ───────────────────────────────────────────────────────────────────
const { uploadFile } = require('./storage');

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const imageGenEnabled = !!GEMINI_KEY;

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

// Call Gemini's image model and return { buffer, mimetype } for the first image.
async function geminiImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini image ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const inline = parts.map((p) => p.inlineData || p.inline_data).find((d) => d?.data);
  if (!inline?.data) throw new Error('Gemini returned no image data');
  return { buffer: Buffer.from(inline.data, 'base64'), mimetype: inline.mimeType || inline.mime_type || 'image/png' };
}

async function generateRecipeImage(title, description) {
  if (GEMINI_KEY) {
    try {
      const prompt = `A professional overhead food photograph of "${title}". ${description || ''} `
        + `Plated on a ceramic plate or bowl on a clean surface, styled like a modern recipe website `
        + `(Gousto / HelloFresh): natural daylight, shallow depth of field, fresh garnish, vibrant and `
        + `appetising, photorealistic, high detail. No text, no logos, no hands, no cutlery brand marks.`;
      const { buffer, mimetype } = await geminiImage(prompt);
      const ext = (mimetype.split('/')[1] || 'png').split(';')[0];
      const stored = await uploadFile(buffer, `ai-recipe.${ext}`, mimetype);
      return { url: stored, generated: true };
    } catch (e) {
      console.error('[images] Gemini generation failed, using placeholder:', e.message);
    }
  }
  return { url: placeholderCard(title), generated: true, placeholder: true };
}

module.exports = { generateRecipeImage, imageGenEnabled };

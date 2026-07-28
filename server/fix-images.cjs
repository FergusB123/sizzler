// Validate every TheMealDB recipe's CURRENT image with Claude vision; if it's
// not a genuine photo of the dish (e.g. a site logo/banner pulled from a page's
// og:image), replace it — preferring a re-scraped source photo that passes the
// same check, then TheMealDB's own thumbnail, then a Gemini render.
//
//   node server/fix-images.cjs [--limit N] [--dry]
// --dry only reports which current images fail the food-photo check (no writes).
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('./database');
const sharp = require(path.join(__dirname, '..', 'client', 'node_modules', 'sharp'));

const DRY = process.argv.includes('--dry');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || null;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const CONCURRENCY = 3;
const IMG_DIR = path.join(__dirname, '..', 'client', 'public', 'recipe-images');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let anthropic;
const ai = () => (anthropic ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

// ---- Claude vision food-photo check ----
const ASSESS_TOOL = {
  name: 'assess_image',
  input_schema: {
    type: 'object',
    properties: {
      food_photo: { type: 'boolean', description: 'true only if this is a real photograph whose clear subject is prepared food / a dish.' },
      kind: { type: 'string', description: 'one of: dish, logo, text, illustration, placeholder, other-photo, unclear' },
    },
    required: ['food_photo', 'kind'],
  },
};
const ASSESS_SYS = `You check whether an image is usable as a recipe's hero photo. Return food_photo=true ONLY for a genuine photograph whose clear subject is prepared food or a dish/drink. Return false for: logos, wordmarks, website banners/headers, icons, illustrations/cartoons, screenshots, text-heavy graphics, "no image"/placeholder graphics, or photos with no food as the subject. Always answer via assess_image.`;

async function assess(buf) {
  const jpeg = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  const res = await ai().messages.create({
    model: MODEL, max_tokens: 200, system: ASSESS_SYS,
    tools: [ASSESS_TOOL], tool_choice: { type: 'tool', name: 'assess_image' },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
      { type: 'text', text: 'Is this a usable recipe dish photo?' },
    ] }],
  });
  const t = res.content.find((b) => b.type === 'tool_use');
  return t?.input || { food_photo: false, kind: 'unclear' };
}

// ---- source-page og:image ----
function extractImage(html) {
  const meta = (p) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*>`, 'i'))?.[0]; return m?.match(/content=["']([^"']+)["']/i)?.[1] || null; };
  let img = meta('og:image') || meta('og:image:url') || meta('twitter:image') || meta('twitter:image:src');
  if (img) return img;
  for (const b of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const d = JSON.parse(b[1].trim()); const ns = Array.isArray(d) ? d : (d['@graph'] || [d]);
      for (const n of ns) { const t = n['@type']; if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) { const im = n.image; if (typeof im === 'string') return im; if (Array.isArray(im)) return typeof im[0] === 'string' ? im[0] : im[0]?.url; if (im?.url) return im.url; } } } catch { /* */ }
  }
  return null;
}
function upgradeUrl(u) { try { const url = new URL(u); if (url.hostname.includes('immediate.co.uk')) { const rs = url.searchParams.get('resize'); const m = rs && rs.match(/^(\d+)[,x](\d+)$/); if (m) { let w = +m[1], h = +m[2]; if (w && w < 1000) { const f = 1000 / w; url.searchParams.set('resize', `${Math.round(w * f)},${Math.round(h * f)}`); } } else url.searchParams.set('resize', '1200,675'); } return url.toString(); } catch { return u; } }
async function fetchBuf(url, accept, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: c.signal }); if (!r.ok) return { status: r.status };
    if (accept.includes('image') && !/image\//i.test(r.headers.get('content-type') || '')) return { err: 'not-image' };
    return accept.includes('image') ? { buf: Buffer.from(await r.arrayBuffer()) } : { html: await r.text() };
  } catch (e) { return { err: e.message }; } finally { clearTimeout(t); }
}
async function geminiImage(title) {
  const prompt = `A professional overhead food photograph of "${title}". Plated on a ceramic plate or bowl, modern recipe-website style, natural daylight, shallow depth of field, appetising, photorealistic. No text, no logos, no hands.`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const d = await r.json(); const parts = d?.candidates?.[0]?.content?.parts || [];
  const inline = parts.map((p) => p.inlineData || p.inline_data).find((x) => x?.data);
  if (!inline?.data) throw new Error('no image'); return Buffer.from(inline.data, 'base64');
}

async function writeImage(base, buf) {
  await sharp(buf).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(IMG_DIR, `${base}.jpg`));
  await sharp(buf).resize(350, 350, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(path.join(IMG_DIR, `${base}-350.jpg`));
}

async function getJson(url) { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } }); if (!r.ok) throw new Error(r.status); return r.json(); }
const normUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').toLowerCase();
const normTitle = (t) => String(t || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

async function main() {
  // Build a TheMealDB lookup for fallback thumbnails: by idMeal, source, title.
  const byId = {}, bySrc = {}, byTitle = {};
  for (const c of 'abcdefghijklmnopqrstuvwxyz') {
    try { const j = await getJson(`https://www.themealdb.com/api/json/v1/1/search.php?f=${c}`);
      for (const m of j.meals || []) { byId[m.idMeal] = m.strMealThumb; if (m.strSource) bySrc[normUrl(m.strSource)] = m.strMealThumb; byTitle[normTitle(m.strMeal)] = m.strMealThumb; } } catch { /* */ }
  }
  const thumbFor = (r) => {
    const idm = String(r.source_url || '').match(/themealdb\.com\/meal\/(\d+)/); if (idm && byId[idm[1]]) return byId[idm[1]];
    return bySrc[normUrl(r.source_url)] || byTitle[normTitle(r.title)] || null;
  };

  let q = "SELECT id, title, source_url, image_url FROM recipes WHERE source='TheMealDB' ORDER BY id";
  if (LIMIT) q += ` LIMIT ${LIMIT}`;
  const { rows } = await pool.query(q);
  console.log(`Checking ${rows.length} TheMealDB images${DRY ? ' (DRY — report only)' : ''}\n`);

  let next = 0, ok = 0, fixedSrc = 0, fixedThumb = 0, fixedGen = 0, unresolved = 0, badList = [];
  async function worker() {
    while (true) {
      const i = next++; if (i >= rows.length) return;
      const r = rows[i];
      const base = path.basename(r.image_url || '').replace(/\.jpg$/i, '');
      const full = path.join(IMG_DIR, `${base}.jpg`);
      try {
        if (!fs.existsSync(full)) { console.log(`? missing file: ${r.title}`); continue; }
        const cur = await assess(fs.readFileSync(full));
        if (cur.food_photo) { ok++; continue; }
        badList.push(`${r.title} [${cur.kind}] ${r.source_url || ''}`);
        if (DRY) continue;

        // 1) try the source page's image, but only accept if vision says it's a dish
        let chosen = null, gen = false, via = '';
        if (r.source_url && !/themealdb\.com/.test(r.source_url)) {
          const page = await fetchBuf(r.source_url, 'text/html');
          if (page.html) {
            let iu = extractImage(page.html);
            if (iu) { iu = upgradeUrl(new URL(iu, r.source_url).toString());
              const dl = await fetchBuf(iu, 'image/*');
              if (dl.buf) { const v = await assess(dl.buf); if (v.food_photo) { chosen = dl.buf; via = 'source'; } } }
          }
        }
        // 2) fall back to TheMealDB's own thumbnail (a real food photo)
        if (!chosen) { const tu = thumbFor(r); if (tu) { const dl = await fetchBuf(tu, 'image/*'); if (dl.buf) { const v = await assess(dl.buf); if (v.food_photo) { chosen = dl.buf; via = 'thumb'; } } } }
        // 3) last resort: generate
        if (!chosen && GEMINI_KEY) { try { chosen = await geminiImage(r.title); gen = true; via = 'generated'; } catch { /* */ } }

        if (!chosen) { unresolved++; console.log(`✗ could not fix: ${r.title}`); continue; }
        await writeImage(base, chosen);
        await pool.query('UPDATE recipes SET image_is_generated = $1 WHERE id = $2', [gen, r.id]);
        if (via === 'source') fixedSrc++; else if (via === 'thumb') fixedThumb++; else fixedGen++;
        console.log(`✓ fixed ${r.title.slice(0, 40)} → ${via}`);
        await sleep(40);
      } catch (e) { console.error(`! ${r.title.slice(0, 36)} — ${e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nGood already: ${ok}. Flagged bad: ${badList.length}.`);
  if (DRY) { console.log('\nBAD:\n' + badList.map((b) => '  • ' + b).join('\n')); }
  else console.log(`Fixed → source photo: ${fixedSrc}, TheMealDB thumb: ${fixedThumb}, generated: ${fixedGen}, unresolved: ${unresolved}.`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

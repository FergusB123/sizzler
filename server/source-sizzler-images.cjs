// Give the Claude-invented "Sizzler" recipes real web photos where a confident
// match exists. They have no source_url (original AI recipes), so we look each
// dish up by name on open sources (Wikipedia/Wikimedia lead image, then
// TheMealDB), and use Claude vision to confirm the photo actually depicts that
// dish before replacing the AI image. No confident match → keep the AI image.
//
//   node server/source-sizzler-images.cjs [--limit N] [--dry]
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('./database');
const sharp = require(path.join(__dirname, '..', 'client', 'node_modules', 'sharp'));

const DRY = process.argv.includes('--dry');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || null;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const CONCURRENCY = 2; // gentle on Openverse's anonymous rate limit
const OV_UA = 'Sizzler/1.0 (personal recipe app)';
const IMG_DIR = path.join(__dirname, '..', 'client', 'public', 'recipe-images');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let anthropic;
const ai = () => (anthropic ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const MATCH_TOOL = {
  name: 'verify_photo',
  input_schema: {
    type: 'object',
    properties: {
      food_photo: { type: 'boolean', description: 'true if this is a real photograph of prepared food (not a logo/graphic/illustration/raw-ingredient shot).' },
      depicts_dish: { type: 'boolean', description: 'true if the food shown is the named dish or a clearly recognisable version of it.' },
    },
    required: ['food_photo', 'depicts_dish'],
  },
};
async function verify(buf, dish) {
  const jpeg = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  const res = await ai().messages.create({
    model: MODEL, max_tokens: 200,
    system: 'You verify whether a candidate photo suits a specific named dish as its hero image. Judge food_photo (a real cooked-food photograph, not a logo/graphic/illustration/single raw ingredient) and depicts_dish (true if the food shown is this dish OR the same core dish with only variation in sides, garnish, pasta shape or plating — e.g. a bolognese-style ragù for a beef ragù, a plain risotto for a mushroom risotto; set false only for a clearly different dish, raw ingredients alone, or non-food). Answer via verify_photo.',
    tools: [MATCH_TOOL], tool_choice: { type: 'tool', name: 'verify_photo' },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
      { type: 'text', text: `Dish: "${dish}". Is this a real photo of this dish?` },
    ] }],
  });
  const t = res.content.find((b) => b.type === 'tool_use');
  return t?.input || { food_photo: false, depicts_dish: false };
}

async function fetchJson(url) { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } }); if (!r.ok) throw new Error(r.status); return r.json(); }
async function fetchImg(url, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: c.signal });
    if (!r.ok) return null; const ct = r.headers.get('content-type') || ''; if (!/image\//i.test(ct) || /svg/i.test(ct)) return null;
    return Buffer.from(await r.arrayBuffer()); } catch { return null; } finally { clearTimeout(t); }
}

// Reduce a recipe title to a core dish name for lookup.
const ADJ = /\b(slow[- ]cooked|creamy|spicy|classic|authentic|homemade|easy|simple|quick|baked|roast(ed)?|grilled|pan[- ]fried|one[- ]pot|one[- ]pan|ultimate|simply|perfect|hearty|zesty|smoky|sticky|crispy|fresh|warm|golden)\b/gi;
function coreName(title) {
  let t = title.replace(/\(.*?\)/g, ' ');
  t = t.split(/\s+(?:with|and|on|in)\s+/i)[0];
  t = t.replace(ADJ, ' ').replace(/\b(bake|traybake)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return t || title;
}

// Real photos from Wikimedia Commons file search (no key, broad food coverage).
async function commonsImages(query) {
  const out = [];
  try {
    const j = await fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=1000&origin=*`);
    const pages = Object.values(j?.query?.pages || {});
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      const u = ii?.thumburl || ii?.url;
      if (u && /\.(jpe?g|png|webp)$/i.test((ii?.url || u).split('?')[0])) out.push(u);
    }
  } catch { /* */ }
  return out;
}

// Openverse: an image-search API aggregating Flickr/Wikimedia/etc. (no key).
// Broadest real-photo coverage for arbitrary dish names.
async function openverseImages(query) {
  try {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=6&mature=false`,
      { headers: { 'User-Agent': OV_UA, Accept: 'application/json' } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.results || []).map((x) => x.url).filter((u) => u && /^https?:\/\//.test(u));
  } catch { return []; }
}

// Candidate image URLs, best-first: Openverse search, Wikipedia lead image, Commons, TheMealDB.
async function candidates(title) {
  const out = [];
  const core = coreName(title);
  out.push(...await openverseImages(core));
  if (out.length < 3) out.push(...await openverseImages(title));
  for (const q of [core, title]) {
    try {
      const j = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&prop=pageimages&piprop=original&origin=*`);
      const pages = Object.values(j?.query?.pages || {});
      for (const p of pages) if (p.original?.source) out.push(p.original.source);
    } catch { /* */ }
    if (out.length) break;
  }
  out.push(...await commonsImages(core));
  try {
    const j = await fetchJson(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(core)}`);
    if (j?.meals?.[0]?.strMealThumb) out.push(j.meals[0].strMealThumb);
  } catch { /* */ }
  return [...new Set(out)].slice(0, 8);
}

async function writeImage(base, buf) {
  await sharp(buf).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(IMG_DIR, `${base}.jpg`));
  await sharp(buf).resize(350, 350, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(path.join(IMG_DIR, `${base}-350.jpg`));
}

async function main() {
  let q = "SELECT id, title, image_url FROM recipes WHERE source='Sizzler' AND image_is_generated = TRUE ORDER BY id";
  if (LIMIT) q += ` LIMIT ${LIMIT}`;
  const { rows } = await pool.query(q);
  console.log(`${rows.length} Sizzler recipes${DRY ? ' (DRY)' : ''}\n`);

  let next = 0, replaced = 0, kept = 0;
  async function worker() {
    while (true) {
      const i = next++; if (i >= rows.length) return;
      const r = rows[i];
      try {
        const cands = await candidates(r.title);
        let chosen = null;
        for (const url of cands) {
          const buf = await fetchImg(url);
          if (!buf) continue;
          const meta = await sharp(buf).metadata().catch(() => ({}));
          if ((meta.width || 0) < 250 || (meta.height || 0) < 200) continue;
          const v = await verify(buf, r.title);
          if (v.food_photo && v.depicts_dish) { chosen = buf; break; }
        }
        if (!chosen) { kept++; if (DRY) console.log(`· keep AI: ${r.title.slice(0, 44)}`); continue; }
        if (DRY) { replaced++; console.log(`✓ would set real photo: ${r.title.slice(0, 44)}`); continue; }
        const base = path.basename(r.image_url).replace(/\.jpg$/i, '');
        await writeImage(base, chosen);
        await pool.query('UPDATE recipes SET image_is_generated = FALSE WHERE id = $1', [r.id]);
        replaced++;
        if (replaced % 15 === 0) console.log(`  …${replaced} sourced`);
        await sleep(40);
      } catch (e) { kept++; console.error(`! ${r.title.slice(0, 34)} — ${e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n${DRY ? 'Would replace' : 'Replaced with real photo'}: ${replaced}, kept AI image: ${kept}.`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

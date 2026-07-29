// Import real recipes from BBC Good Food into the library as dinners.
//
// BBC Good Food has no public API (unlike Gousto), but every recipe page carries
// full schema.org/Recipe JSON-LD (ingredients, method, cuisine, servings, real
// per-portion calories, image). We discover recipe URLs via their sitemaps,
// parse the JSON-LD, and — as with the other importers — REWRITE the method in
// Claude's own words (original, not copied) before storing. source_url is kept
// for attribution. Polite crawl: browser UA, low concurrency, delays, recipe
// pages only (robots.txt allows /recipes/ for general agents; /api/* is not used).
//
//   node server/import-bbcgoodfood.cjs [count] [--dry]
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('./database');
const { loadBlocklist } = require('./blocklist');
const { DishSet } = require('./similar');

const TARGET = Number(process.argv.find((a) => /^\d+$/.test(a))) || 50;
const DRY = process.argv.includes('--dry');
// --popular: bias to familiar/comfort dishes rather than niche/world cuisines.
const POPULAR = process.argv.includes('--popular');

// Popular everyday dishes, most-mainstream first. Slugs are matched as substrings
// against the sitemap URL pool; only a couple of each are taken for variety.
const POPULAR_SLUGS = [
  'spaghetti-bolognese', 'beef-lasagne', 'lasagne', 'cottage-pie', 'shepherds-pie', 'chilli-con-carne',
  'macaroni-cheese', 'mac-and-cheese', 'spaghetti-carbonara', 'carbonara', 'fish-pie', 'beef-stew',
  'sausage-casserole', 'toad-in-the-hole', 'fish-and-chips', 'fishcakes', 'chicken-and-mushroom-pie',
  'chicken-pie', 'steak-and-ale-pie', 'roast-chicken', 'chicken-curry', 'chicken-tikka-masala', 'korma',
  'chicken-jalfrezi', 'katsu-curry', 'chicken-fajitas', 'beef-stir-fry', 'chicken-stir-fry', 'meatballs',
  'beef-burger', 'homemade-pizza', 'margherita', 'mushroom-risotto', 'risotto', 'paella',
  'sweet-and-sour', 'chow-mein', 'egg-fried-rice', 'beef-tacos', 'enchiladas', 'pad-thai',
  'chicken-biryani', 'tuna-pasta-bake', 'pasta-bake', 'creamy-chicken', 'pesto', 'chicken-noodle-soup',
  'tomato-soup', 'leek-and-potato', 'minestrone', 'moussaka', 'chicken-tagine', 'gammon', 'pork-chops',
  'salmon', 'quiche', 'frittata', 'chicken-casserole', 'beef-casserole', 'hotpot', 'jacket-potato',
];
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const CONCURRENCY = 2;
const IMG_DIR = path.join(__dirname, '..', 'client', 'public', 'recipe-images');
const sharp = require(path.join(__dirname, '..', 'client', 'node_modules', 'sharp'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const J = (v) => JSON.stringify(v ?? []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (t) => (t || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]/g, '');
const loose = (t) => (t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(easy|classic|simple|best|ultimate|the|with|and|our|perfect|quick|homemade)\b/g, ' ').replace(/\s+/g, ' ').trim();
const slug = (s) => (s || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

let anthropic;
const ai = () => (anthropic ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

async function get(url, accept = 'text/html', ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: c.signal });
    return { status: r.status, ct: r.headers.get('content-type') || '', body: await r.text() }; }
  catch (e) { return { err: e.message }; } finally { clearTimeout(t); }
}
async function getBuf(url, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: c.signal });
    if (!r.ok || !/image\//i.test(r.headers.get('content-type') || '')) return null;
    return Buffer.from(await r.arrayBuffer()); } catch { return null; } finally { clearTimeout(t); }
}

// ---- discover recipe URLs from the sitemaps ----
async function collectUrls(need) {
  const idx = await get('https://www.bbcgoodfood.com/sitemap.xml', 'text/xml');
  const subs = [...(idx.body || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /recipe\.xml$/i.test(u));
  const urls = [];
  const seen = new Set();
  for (const sub of subs) {
    const s = await get(sub, 'text/xml');
    for (const m of (s.body || '').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = m[1];
      if (/\/recipes\/[a-z0-9-]+$/i.test(u) && !/\/recipes\/(how-to|collection)/i.test(u) && !seen.has(u)) { seen.add(u); urls.push(u); }
    }
    if (urls.length >= need) break;
    await sleep(50);
  }
  return urls;
}

// Reorder a URL pool so familiar/popular dishes come first (max 2 per dish),
// then everything else as fallback to still reach the target.
function orderByPopular(urls) {
  const items = urls.map((u) => ({ u, slug: u.split('/').pop() }));
  const picked = [], used = new Set();
  for (const kw of POPULAR_SLUGS) {
    let n = 0;
    for (const { u, slug } of items) {
      if (n >= 2) break;
      if (!used.has(u) && slug.includes(kw)) { used.add(u); picked.push(u); n++; }
    }
  }
  for (const { u } of items) if (!used.has(u)) picked.push(u);
  return picked;
}

// ---- JSON-LD Recipe extraction ----
function recipeLd(html) {
  for (const b of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(b[1].trim());
      const ns = Array.isArray(d) ? d : (d['@graph'] || [d]);
      for (const n of ns) { const t = n['@type']; if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return n; }
    } catch { /* */ }
  }
  return null;
}
const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
function stepsFromLd(ld) {
  const out = [];
  const walk = (items) => { for (const it of asArray(items)) {
    if (typeof it === 'string') out.push(it);
    else if (it['@type'] === 'HowToSection') walk(it.itemListElement);
    else if (it.text) out.push(it.text);
  } };
  walk(ld.recipeInstructions);
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
function imageUrl(ld) {
  const im = ld.image;
  if (typeof im === 'string') return im;
  if (Array.isArray(im)) return typeof im[0] === 'string' ? im[0] : im[0]?.url;
  return im?.url || null;
}
function caloriesFromLd(ld) {
  const c = ld.nutrition?.calories;
  if (!c) return null;
  const m = String(c).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
function servingsFromLd(ld) {
  const y = Array.isArray(ld.recipeYield) ? ld.recipeYield[0] : ld.recipeYield;
  const m = String(y || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
const catStr = (ld) => asArray(ld.recipeCategory).join(', ').toLowerCase();
const NON_DINNER = /\b(dessert|cake|biscuit|cookie|drink|cocktail|smoothie|side dish|condiment|sauce|jam|preserve|chutney|breakfast|baking|bread|frosting|icing)\b/i;
const isMain = (ld) => /main course|dinner|lunch|supper|pasta|curry|casserole|stew|pie|roast|traybake/i.test(catStr(ld)) && !NON_DINNER.test(catStr(ld));

// immediate.co.uk: enlarge small resize variants (don't strip → square default)
function upgradeImg(u) {
  try { const url = new URL(u);
    if (url.hostname.includes('immediate.co.uk')) { const rs = url.searchParams.get('resize'); const m = rs && rs.match(/^(\d+)[,x](\d+)$/);
      if (m) { const w = +m[1], h = +m[2]; if (w < 1000) { const f = 1000 / w; url.searchParams.set('resize', `${Math.round(w * f)},${Math.round(h * f)}`); } }
      else url.searchParams.set('resize', '1200,675'); }
    return url.toString(); } catch { return u; }
}

// ---- Claude rewrite (original wording) ----
const RECIPE_TOOL = {
  name: 'save_recipe',
  input_schema: { type: 'object', properties: {
    title: { type: 'string' }, cuisine: { type: 'string' }, category: { type: 'string' },
    description: { type: 'string', description: 'One fresh appetising sentence, your own words.' },
    ingredients: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, quantity: { type: 'string' }, unit: { type: 'string' }, raw: { type: 'string' } }, required: ['name', 'raw'] } },
    steps: { type: 'array', items: { type: 'string' }, description: 'Method reworded in your own words, one action per step.' },
    prep_minutes: { type: 'integer' }, cook_minutes: { type: 'integer' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, servings: { type: 'integer' },
    calories: { type: 'integer', description: 'kcal per portion if derivable, else estimate.' },
    tags: { type: 'array', items: { type: 'string' } },
  }, required: ['title', 'cuisine', 'ingredients', 'steps', 'difficulty'] },
};
const REWRITE_SYS = `You are Sizzler's recipe editor. You are given a real recipe (title, cuisine, ingredients, method) as reference only. Return a clean, ORIGINAL version via save_recipe.
- Keep the dish authentic (same core ingredients, quantities, technique).
- REWRITE every method step in your own words as clear imperative instructions — do NOT copy sentences or distinctive phrasing from the source. One action per step.
- Normalise ingredients to name + quantity + unit; put a tidy standardised line in "raw".
- Fresh one-sentence description. Infer difficulty honestly; estimate prep/cook minutes. Keep servings if given.
- Always return via save_recipe.`;

async function rewrite(ld) {
  const ref = [
    `Dish: ${ld.name}`, ld.recipeCuisine ? `Cuisine: ${asArray(ld.recipeCuisine).join(', ')}` : '',
    ld.recipeCategory ? `Category: ${catStr(ld)}` : '', '', 'Ingredients:',
    ...asArray(ld.recipeIngredient).map((i) => `- ${i}`), '', 'Method (reference — reword entirely):',
    ...stepsFromLd(ld).map((s, i) => `${i + 1}. ${s}`),
  ].filter((x) => x !== undefined).join('\n');
  const res = await ai().messages.create({
    model: MODEL, max_tokens: 2048, system: REWRITE_SYS,
    tools: [RECIPE_TOOL], tool_choice: { type: 'tool', name: 'save_recipe' },
    messages: [{ role: 'user', content: [{ type: 'text', text: `Rewrite this recipe:\n\n${ref}` }] }],
  });
  const tool = res.content.find((b) => b.type === 'tool_use');
  if (!tool) throw new Error('no structured recipe');
  return tool.input;
}

async function writeImage(base, buf) {
  await sharp(buf).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(IMG_DIR, `${base}.jpg`));
  await sharp(buf).resize(350, 350, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(path.join(IMG_DIR, `${base}-350.jpg`));
}

async function main() {
  if (!DRY) fs.mkdirSync(IMG_DIR, { recursive: true });
  const { rows: owners } = await pool.query('SELECT user_id, COUNT(*)::int n FROM recipes GROUP BY user_id ORDER BY n DESC LIMIT 1');
  const userId = owners[0].user_id;
  const { rows: ex } = await pool.query('SELECT title, source_url FROM recipes WHERE user_id = $1', [userId]);
  const have = new Set(); const haveUrl = new Set();
  for (const r of ex) { have.add(norm(r.title)); have.add(loose(r.title)); if (r.source_url) haveUrl.add(r.source_url.replace(/\/+$/, '')); }
  // Never re-add anything the user has deleted.
  const blocked = await loadBlocklist(pool, userId);
  for (const t of blocked.titles) { have.add(norm(t)); have.add(loose(t)); }
  for (const u of blocked.urls) haveUrl.add(u);
  // Near-duplicate guard: skip dishes we effectively already have (whole library
  // + blocklist), e.g. don't add "Next-Level Moussaka" when a moussaka exists.
  const dishes = new DishSet([...ex.map((r) => r.title), ...blocked.titles]);

  let urls = await collectUrls(POPULAR ? 2000 : TARGET * 6);
  if (POPULAR) urls = orderByPopular(urls);
  console.log(`Discovered ${urls.length} candidate URLs; importing up to ${TARGET} ${POPULAR ? 'popular ' : ''}dinners${DRY ? ' (DRY)' : ''} · blocklist ${blocked.titles.length}.\n`);

  let next = 0, ok = 0, failed = 0, skip = 0, realCal = 0;
  const diff = { easy: 0, medium: 0, hard: 0 }, cuisines = new Set();
  async function worker() {
    while (true) {
      if (ok >= TARGET) return;
      const i = next++; if (i >= urls.length) return;
      const url = urls[i];
      if (haveUrl.has(url.replace(/\/+$/, ''))) { skip++; continue; }
      try {
        const pg = await get(url);
        if (pg.status !== 200 || !pg.body) { failed++; continue; }
        const ld = recipeLd(pg.body);
        if (!ld || !ld.recipeIngredient?.length || !ld.recipeInstructions?.length) { skip++; continue; }
        if (!isMain(ld)) { skip++; continue; }
        if (have.has(norm(ld.name)) || have.has(loose(ld.name)) || dishes.has(ld.name)) { skip++; continue; }
        if (ok >= TARGET) return;

        const r = await rewrite(ld);
        if (!r.title || !r.steps?.length) { failed++; continue; }
        if (have.has(norm(r.title)) || have.has(loose(r.title)) || dishes.has(r.title)) { skip++; continue; }
        have.add(norm(r.title)); have.add(loose(r.title)); dishes.add(r.title);
        const ldCal = caloriesFromLd(ld);
        const cal = ldCal || r.calories || null;
        const servings = servingsFromLd(ld) || r.servings || 4;

        if (DRY) { console.log(`✓ [${ok + 1}] ${r.title}  [${r.cuisine}/${r.difficulty}]  ${cal ? cal + 'kcal' : '—'}${ldCal ? '(real)' : ''}`); ok++; continue; }

        const base = slug(r.title);
        let imgOk = false;
        const iu = imageUrl(ld);
        if (iu) { const buf = await getBuf(upgradeImg(new URL(iu, url).toString())); if (buf) { try { const m = await sharp(buf).metadata(); if ((m.width || 0) >= 300) { await writeImage(base, buf); imgOk = true; } } catch { /* */ } } }

        await pool.query(
          `INSERT INTO recipes (user_id, title, cuisine, category, description, ingredients, steps,
             image_url, image_is_generated, prep_minutes, cook_minutes, difficulty, servings,
             meal_types, tags, source, source_kind, source_url, calories)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12,$13,$14,'BBC Good Food','url',$15,$16)`,
          [userId, r.title, r.cuisine, r.category || asArray(ld.recipeCategory)[0] || null, r.description || null,
           J(r.ingredients), J(r.steps), imgOk ? `/recipe-images/${base}.jpg` : null,
           r.prep_minutes || null, r.cook_minutes || null, r.difficulty, servings,
           J(['dinner']), J((r.tags || []).slice(0, 6)), url, cal]);
        ok++; diff[r.difficulty] = (diff[r.difficulty] || 0) + 1; cuisines.add(r.cuisine); if (ldCal) realCal++;
        console.log(`✓ [${ok}/${TARGET}] ${r.title.slice(0, 44)}  [${r.cuisine}/${r.difficulty}]${imgOk ? '' : ' (no img)'}${cal ? ' ' + cal + 'kcal' : ''}`);
        await sleep(120);
      } catch (e) { failed++; console.error(`✗ ${url.split('/').pop()} — ${e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n${DRY ? 'Would import' : 'Imported'} ${ok}, skipped ${skip}, failed ${failed}.`);
  if (!DRY) { console.log(`Difficulty — easy ${diff.easy}, medium ${diff.medium}, hard ${diff.hard}; real calories ${realCal}/${ok}`);
    console.log(`${cuisines.size} cuisines: ${[...cuisines].sort().join(', ')}`); }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

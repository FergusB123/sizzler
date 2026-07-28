// Importer: pull REAL recipes from TheMealDB (an open, developer-intended recipe
// API — real ingredients, methods, cuisines and photos) and ADD them to the
// library as dinners.
//
// Copyright-clean by design: the source method text is NOT stored verbatim.
// Every recipe is passed through Claude with an explicit "rewrite in your own
// words" instruction, so the stored method is original and publishable. The
// real source photo is downloaded and served as a static asset; source_url is
// kept for attribution.
//
//   node server/import-themealdb.cjs [count]        (default 100)
//   node server/import-themealdb.cjs 3 --dry        (fetch+rewrite N, NO DB writes, NO images)
//
// Idempotent: skips meals whose (normalised) title already exists, and reuses
// any image already on disk — so a re-run after a crash/timeout resumes cheaply.
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('./database');

const TARGET = Number(process.argv.find((a) => /^\d+$/.test(a))) || 100;
const DRY = process.argv.includes('--dry');
// --simple: ignore country balancing and pick the simplest weeknight-friendly
// mains (fewest ingredients / shortest method), with only light category/area
// caps so it isn't 50 chicken dishes.
const SIMPLE = process.argv.includes('--simple');
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const CONCURRENCY = 3;
const MAX_PER_AREA = Math.max(5, Math.ceil(TARGET / 12)); // spread across countries
const VEG_CAP = Math.round(TARGET * 0.2);                 // ~20% vegetarian mains
const IMG_DIR = path.join(__dirname, '..', 'client', 'public', 'recipe-images');
const sharp = require(path.join(__dirname, '..', 'client', 'node_modules', 'sharp'));

const J = (v) => JSON.stringify(v ?? []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (t) => (t || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]/g, '');
const loose = (t) => (t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(authentic|classic|homemade|easy|simple|the|with|and|style|traditional|best|ultimate|spicy|creamy|recipe)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const slug = (s) => (s || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// ── Which TheMealDB categories count as a dinner main ──────────────────
const MAIN_CATS = new Set(['Beef', 'Chicken', 'Pork', 'Lamb', 'Seafood', 'Pasta', 'Goat', 'Vegetarian', 'Vegan']);
// Obvious non-mains that slip into Vegetarian/Vegan/Misc — skip by title.
const NON_MAIN_RE = /\b(salad|dip|bread|cake|crumble|tart|pancake|smoothie|juice|jam|chutney|pickle|sauce|oil|dressing|cookie|muffin|scone|biscuit|fritter|pudding|parfait|frosting|loaf|bun|roll|toast)\b/i;

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Sizzler importer)' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// Flatten TheMealDB's strIngredient1..20 / strMeasure1..20 into clean lines.
function ingredientLines(m) {
  const lines = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || '').trim();
    const meas = (m[`strMeasure${i}`] || '').trim();
    if (!name || /^null$/i.test(name)) continue;
    lines.push(meas && !/^null$/i.test(meas) ? `${meas} ${name}` : name);
  }
  return lines;
}

// ── Rewrite step (Claude) — original wording, structured output ────────
const RECIPE_TOOL = {
  name: 'save_recipe',
  description: 'Save the rewritten, original recipe.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'A clean, natural dish name (drop any "Recipe" suffix).' },
      cuisine: { type: 'string', description: 'e.g. Italian, Thai, Turkish, Jamaican' },
      category: { type: 'string', description: 'e.g. Curry, Stew, Pasta, Traybake, Stir-fry' },
      description: { type: 'string', description: 'One fresh, appetising sentence.' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'string', description: 'Numeric amount e.g. "500", "1/2". Empty if none.' },
            unit: { type: 'string', description: 'e.g. g, ml, tbsp, clove. Empty if none.' },
            raw: { type: 'string', description: 'A tidy standardised line, e.g. "500 g beef mince".' },
          },
          required: ['name', 'raw'],
        },
      },
      steps: { type: 'array', items: { type: 'string' }, description: 'Ordered method steps, reworded in your own words.' },
      prep_minutes: { type: 'integer' },
      cook_minutes: { type: 'integer' },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      servings: { type: 'integer' },
      calories: { type: 'integer', description: 'Approximate energy per portion, in kcal.' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'cuisine', 'ingredients', 'steps', 'difficulty'],
  },
};

const REWRITE_SYSTEM = `You are Sizzler's recipe editor. You are given a REAL recipe (title, cuisine, ingredients and method) as reference material only. Produce a clean, ORIGINAL version via the save_recipe tool.

Rules:
- Keep the dish authentic: same core ingredients, quantities and technique.
- REWRITE every method step in your own words as clear, imperative instructions. Do NOT copy sentences or distinctive phrasing from the source — reword it entirely.
- Split the method into sensible individual steps (one action each). Fix any obvious typos/broken text in the source.
- Normalise ingredients into name + quantity + unit; put a tidy standardised line in "raw" (do not just copy the source string verbatim).
- Write a fresh one-sentence description in your own words.
- Infer difficulty honestly from the technique and step count (easy / medium / hard), estimate prep_minutes and cook_minutes, and estimate calories per portion (kcal) from the ingredients and servings. Default servings to 4 if unclear.
- Always return via save_recipe. Never reply with prose.`;

let anthropic;
function ai() { return (anthropic ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })); }

async function rewrite(meal) {
  const ref = [
    `Dish: ${meal.strMeal}`,
    meal.strArea && meal.strArea !== 'Unknown' ? `Cuisine/region: ${meal.strArea}` : '',
    meal.strCategory ? `Category: ${meal.strCategory}` : '',
    meal.strTags ? `Tags: ${meal.strTags}` : '',
    '', 'Ingredients:', ...ingredientLines(meal).map((l) => `- ${l}`),
    '', 'Method (reference — reword entirely):', (meal.strInstructions || '').trim(),
  ].filter((x) => x !== undefined).join('\n');

  const res = await ai().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: REWRITE_SYSTEM,
    tools: [RECIPE_TOOL],
    tool_choice: { type: 'tool', name: 'save_recipe' },
    messages: [{ role: 'user', content: [{ type: 'text', text: `Rewrite this recipe:\n\n${ref}` }] }],
  });
  const tool = res.content.find((b) => b.type === 'tool_use');
  if (!tool) throw new Error('no structured recipe returned');
  return tool.input;
}

// ── Images: download the real source photo → static asset ──────────────
async function geminiImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const inline = parts.map((p) => p.inlineData || p.inline_data).find((d) => d?.data);
  if (!inline?.data) throw new Error('no image data');
  return Buffer.from(inline.data, 'base64');
}

// Returns { url, generated }. Prefers the real source photo; generates only on failure.
async function makeImage(recipe, srcThumb) {
  const name = slug(recipe.title);
  const full = path.join(IMG_DIR, `${name}.jpg`);
  const thumb = path.join(IMG_DIR, `${name}-350.jpg`);
  if (fs.existsSync(full) && fs.existsSync(thumb)) return { url: `/recipe-images/${name}.jpg`, generated: false };

  let buf, generated = false;
  if (srcThumb) {
    try {
      const r = await fetch(srcThumb, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) buf = Buffer.from(await r.arrayBuffer());
    } catch { /* fall through to generation */ }
  }
  if (!buf && GEMINI_KEY) {
    const prompt = `A professional overhead food photograph of "${recipe.title}". ${recipe.description || ''} `
      + `Plated on a ceramic plate or bowl on a clean surface, styled like a modern recipe website: `
      + `natural daylight, shallow depth of field, fresh garnish, vibrant and appetising, photorealistic. `
      + `No text, no logos, no hands.`;
    buf = await geminiImage(prompt); generated = true;
  }
  if (!buf) throw new Error('no image available');

  await sharp(buf).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(full);
  await sharp(buf).resize(350, 350, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(thumb);
  return { url: `/recipe-images/${name}.jpg`, generated };
}

// ── Selection: diverse spread across countries + proteins ──────────────
function curate(meals, have) {
  const fresh = meals.filter((m) => {
    if (have.has(norm(m.strMeal)) || have.has(loose(m.strMeal))) return false;
    if (!MAIN_CATS.has(m.strCategory)) return false;
    const vegLike = m.strCategory === 'Vegetarian' || m.strCategory === 'Vegan';
    if (vegLike && NON_MAIN_RE.test(m.strMeal)) return false;
    return !!m.strMealThumb;
  });

  // Simple weeknight mode: rank by a simplicity proxy (ingredient count + method
  // length), take the simplest, with only light caps so there's some variety.
  if (SIMPLE) {
    const score = (m) => ingredientLines(m).length + (m.strInstructions || '').length / 130;
    const sorted = fresh.slice().sort((a, b) => score(a) - score(b) || a.strMeal.localeCompare(b.strMeal));
    const AREA_CAP = 8, CAT_CAP = Math.max(6, Math.ceil(TARGET / 4));
    const perArea = {}, perCat = {}, picked = [];
    for (const pass of [true, false]) { // pass 1 honours caps; pass 2 tops up
      for (const m of sorted) {
        if (picked.length >= TARGET) break;
        if (picked.includes(m)) continue;
        const a = m.strArea && m.strArea !== 'Unknown' ? m.strArea : 'International';
        if (pass && ((perArea[a] || 0) >= AREA_CAP || (perCat[m.strCategory] || 0) >= CAT_CAP)) continue;
        perArea[a] = (perArea[a] || 0) + 1; perCat[m.strCategory] = (perCat[m.strCategory] || 0) + 1;
        picked.push(m);
      }
    }
    return picked;
  }

  // bucket by area (fallback to category) for round-robin balance
  const areaOf = (m) => (m.strArea && m.strArea !== 'Unknown' ? m.strArea : 'International');
  const buckets = new Map();
  for (const m of fresh) {
    const a = areaOf(m);
    if (!buckets.has(a)) buckets.set(a, []);
    buckets.get(a).push(m);
  }
  // stable pseudo-shuffle within buckets by idMeal so re-runs are deterministic
  for (const arr of buckets.values()) arr.sort((a, b) => (a.idMeal % 97) - (b.idMeal % 97) || a.strMeal.localeCompare(b.strMeal));

  const order = [...buckets.keys()].sort((a, b) => buckets.get(b).length - buckets.get(a).length);
  const picked = [];
  const perArea = {};
  let veg = 0;
  let progress = true;
  while (picked.length < TARGET && progress) {
    progress = false;
    for (const a of order) {
      if (picked.length >= TARGET) break;
      if ((perArea[a] || 0) >= MAX_PER_AREA) continue;
      const arr = buckets.get(a);
      // take the next unused main from this area, honouring the veg cap
      const idx = arr.findIndex((m) => !m._used
        && !((m.strCategory === 'Vegetarian' || m.strCategory === 'Vegan') && veg >= VEG_CAP));
      if (idx === -1) continue;
      const m = arr[idx]; m._used = true;
      picked.push(m); perArea[a] = (perArea[a] || 0) + 1;
      if (m.strCategory === 'Vegetarian' || m.strCategory === 'Vegan') veg++;
      progress = true;
    }
  }
  return picked;
}

async function main() {
  if (!DRY) fs.mkdirSync(IMG_DIR, { recursive: true });

  // Enumerate the whole free catalogue (search by first letter).
  const byId = new Map();
  for (const c of 'abcdefghijklmnopqrstuvwxyz') {
    try {
      const j = await getJson(`https://www.themealdb.com/api/json/v1/1/search.php?f=${c}`);
      for (const m of j.meals || []) { m.idMeal = Number(m.idMeal); byId.set(m.idMeal, m); }
    } catch (e) { console.error('list', c, e.message); }
  }
  const meals = [...byId.values()];

  // Target account = the library owner (most recipes), like import-generated.
  const { rows: owners } = await pool.query(
    'SELECT user_id, COUNT(*)::int n FROM recipes GROUP BY user_id ORDER BY n DESC LIMIT 1');
  if (!owners.length) throw new Error('no existing recipes — cannot infer target user');
  const userId = owners[0].user_id;
  const { rows: ex } = await pool.query('SELECT title FROM recipes WHERE user_id = $1', [userId]);
  const have = new Set();
  for (const r of ex) { have.add(norm(r.title)); have.add(loose(r.title)); }

  const picks = curate(meals, have);
  const areaSummary = {};
  for (const m of picks) areaSummary[m.strArea || 'International'] = (areaSummary[m.strArea || 'International'] || 0) + 1;
  console.log(`Catalogue ${meals.length} · library ${ex.length} · selected ${picks.length} dinners`);
  console.log('Country spread:', JSON.stringify(areaSummary));
  console.log(DRY ? '\n— DRY RUN: rewriting only, no DB writes, no images —\n' : '');

  let next = 0, ok = 0, failed = 0, gen = 0;
  const diff = { easy: 0, medium: 0, hard: 0 };
  const cuisines = new Set();

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= picks.length) return;
      const m = picks[i];
      try {
        const r = await rewrite(m);
        if (!r.title || r.title === 'NOT_A_RECIPE' || !r.steps?.length) throw new Error('bad rewrite');
        // guard: re-check dedupe after Claude may have tidied the title
        if (have.has(norm(r.title)) || have.has(loose(r.title))) { console.log(`· skip dup after rewrite: ${r.title}`); continue; }
        have.add(norm(r.title)); have.add(loose(r.title));

        if (DRY) {
          console.log(`\n[${i + 1}] ${r.title}  [${r.cuisine}/${r.difficulty}]  src:${m.strMeal} (${m.strArea})`);
          console.log('  ' + (r.description || ''));
          console.log('  ingredients:', r.ingredients.length, '· steps:', r.steps.length);
          console.log('  step1:', r.steps[0]);
          ok++; diff[r.difficulty] = (diff[r.difficulty] || 0) + 1; cuisines.add(r.cuisine);
          continue;
        }

        const img = await makeImage(r, m.strMealThumb);
        if (img.generated) gen++;
        const src = m.strSource || `https://www.themealdb.com/meal/${m.idMeal}`;
        await pool.query(
          `INSERT INTO recipes (user_id, title, cuisine, category, description, ingredients, steps,
             image_url, image_is_generated, prep_minutes, cook_minutes, difficulty, servings,
             meal_types, tags, source, source_kind, source_url, calories)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'url',$17,$18)`,
          [userId, r.title, r.cuisine, r.category || null, r.description || null,
           J(r.ingredients), J(r.steps), img.url, img.generated,
           r.prep_minutes || null, r.cook_minutes || null, r.difficulty, r.servings || 4,
           J(['dinner']), J((r.tags || []).slice(0, 6)), 'TheMealDB', src, r.calories || null]);
        ok++; diff[r.difficulty] = (diff[r.difficulty] || 0) + 1; cuisines.add(r.cuisine);
        console.log(`✓ [${ok + failed}/${picks.length}] ${r.title}  [${r.cuisine}/${r.difficulty}]${img.generated ? ' (gen img)' : ''}`);
        await sleep(80);
      } catch (e) {
        failed++;
        console.error(`✗ [${ok + failed}/${picks.length}] ${m.strMeal} — ${e.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n${DRY ? 'Rewrote' : 'Imported'} ${ok}, failed ${failed}${DRY ? '' : `, generated images ${gen}`}.`);
  console.log(`Difficulty — easy ${diff.easy}, medium ${diff.medium}, hard ${diff.hard}`);
  console.log(`${cuisines.size} cuisines: ${[...cuisines].sort().join(', ')}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

// Importer: pull real recipes from Gousto's public cookbook API and ADD them to
// the demo user's library. Gousto's data is already structured (ingredients with
// quantities, clean HTML method, cuisine, times) so we parse it directly — no AI
// call per recipe, which makes bulk imports fast and reliable.
// Idempotent: skips recipes already imported (matched by source URL), so it
// never duplicates and never deletes existing recipes or meal-plan slots.
//   node server/import-gousto.cjs [count]   (default 10)
require('dotenv').config({ override: true });
const pool = require('./database');
const { initDatabase } = require('./database');

const TARGET = Number(process.argv[2]) || 10;
// Allow more per cuisine on bigger batches, while keeping some variety.
const MAX_PER_CUISINE = Math.max(3, Math.ceil(TARGET / 8));
const DEMO_EMAIL = 'demo@sizzler.app';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const API = 'https://production-api.gousto.co.uk/cmsreadbroker/v1';
const J = (v) => JSON.stringify(v ?? []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, ' ')
    .replace(/\[s\]|\[es\]/gi, '').replace(/\n{2,}/g, '\n').trim();
}

// Gousto encodes portion sizes as duplicate ingredient rows; the smaller
// portion is suffixed " x0". Keep one row per ingredient, preferring the
// non-x0 (larger / 4-portion) quantity.
function cleanIngredients(ingredients) {
  const byName = new Map();
  for (const ing of ingredients || []) {
    const name = (ing.name || ing.label || '').trim();
    if (!name) continue;
    const hasX0 = / x0\s*$/i.test(ing.label || '');
    const clean = (ing.label || name).replace(/\s*x0\s*$/i, '').trim();
    const prev = byName.get(name);
    if (!prev || (prev.hasX0 && !hasX0)) byName.set(name, { clean, hasX0 });
  }
  return [...byName.values()].map((v) => v.clean);
}

// Parse a cleaned Gousto ingredient label into {name, quantity, unit, raw}.
// e.g. "Ground turmeric (0.5tsp)" → name "Ground turmeric", qty "0.5", unit "tsp";
//      "Tomato" → name only.
function parseIngredient(label) {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { name: label.trim(), quantity: '', unit: '', raw: label.trim() };
  const name = m[1].trim();
  const amount = m[2].trim();
  const am = amount.match(/^([\d.,/]+)\s*(.*)$/);
  const quantity = am ? am[1] : '';
  const unit = am ? am[2].trim() : amount;
  return { name, quantity, unit, raw: `${amount} ${name}`.trim() };
}

// Method steps: split Gousto's grouped HTML instructions into individual lines.
function stepsFrom(e) {
  return (e.cooking_instructions || [])
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap((s) => stripHtml(s.instruction).split('\n'))
    .map((t) => t.trim())
    .filter(Boolean);
}

function inferDifficulty(stepCount, totalMins) {
  if (totalMins >= 55 || stepCount >= 13) return 'hard';
  if (totalMins && totalMins <= 25 && stepCount <= 8) return 'easy';
  return 'medium';
}

function largestImage(media) {
  const imgs = (media?.images || []).slice().sort((a, b) => (a.width || 0) - (b.width || 0));
  return imgs.length ? imgs[imgs.length - 1].image : null;
}

const BREAKFAST_RE = /\b(breakfast|brunch|pancake|porridge|oat|oats|granola|waffle|omelette|frittata|shakshuka|egg|eggs|french toast|smoothie|muesli|bagel|crumpet|hash brown)\b/i;
const LUNCH_RE = /\b(sandwich|salad|soup|wrap|toastie|flatbread|baguette|panini|ciabatta|taco|tacos|quesadilla|burrito|pitta|pita|bao|melt|sub|roll|toast)\b/i;

// One primary meal per recipe (from its title) — used to balance the batch so
// dinner doesn't crowd out breakfast/lunch.
function primaryMeal(title) {
  if (BREAKFAST_RE.test(title)) return 'breakfast';
  if (LUNCH_RE.test(title)) return 'lunch';
  return 'dinner';
}

// Final stored meal_types: breakfast dishes → breakfast; lunchy or quick/light
// dishes also suit lunch; everything else is dinner. Unioned with the parser's
// own guess so the planner has options for every meal.
function mealTypesFor(title, category, totalMins, parsedMeals) {
  const hay = `${title} ${category || ''}`;
  const meals = new Set(parsedMeals || []);
  if (BREAKFAST_RE.test(hay)) meals.add('breakfast');
  if (LUNCH_RE.test(hay) || (totalMins && totalMins <= 30)) meals.add('lunch');
  const onlyBreakfast = meals.has('breakfast') && meals.size === 1;
  if (!onlyBreakfast) meals.add('dinner');
  if (!meals.size) meals.add('dinner');
  return [...meals];
}

// Collapse Gousto's near-duplicates (same dish as thigh/breast, brown/white
// rice, "free range"/"lean", etc.) so a big import isn't full of repeats.
function normTitle(t) {
  return String(t).toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(free range|organic|lean|jumbo|king|extra special|simply perfect|ultimate|homemade|classic|special|style)\b/g, ' ')
    .replace(/\b(thigh|thighs|breast|breasts|fillet|fillets|leg|legs|rump|loin|mince)\b/g, ' ')
    .replace(/\b(brown|white|basmati|long grain|wholewheat|wholemeal|jasmine)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

async function run() {
  await initDatabase();

  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL]);
  if (!userRows[0]) throw new Error(`Demo user ${DEMO_EMAIL} not found — run \`npm run seed\` first.`);
  const userId = userRows[0].id;

  // What's already in the library — skip exact + near-duplicate titles and keep
  // cuisine balance across the whole library (not just this batch).
  const { rows: existing } = await pool.query(
    'SELECT title, cuisine, source_url FROM recipes WHERE user_id = $1', [userId]);
  const existingSlugs = new Set(existing.map((r) => (r.source_url || '').split('/').filter(Boolean).pop()).filter(Boolean));
  const seenNorm = new Set(existing.map((r) => normTitle(r.title)));
  const cuisineCount = {};
  for (const r of existing) if (r.cuisine) cuisineCount[r.cuisine] = (cuisineCount[r.cuisine] || 0) + 1;

  // Meal-mix targets. Gousto skews heavily to dinner, so breakfast/lunch get
  // reserved slots in pass 1 and dinner soaks up the remainder in pass 2.
  const bfTarget = Math.round(TARGET * 0.18);
  const lunchTarget = Math.round(TARGET * 0.37);
  const MEAL_TARGET = { breakfast: bfTarget, lunch: lunchTarget, dinner: TARGET - bfTarget - lunchTarget };

  // Window through the catalogue (API ignores page/count, honours offset),
  // collecting new, non-duplicate candidates tagged with a primary meal.
  const PAGE = 16;
  const seenSlug = new Set();
  const candidates = [];
  for (let offset = 0; offset < 9000; offset += PAGE) {
    let list;
    try { list = await getJson(`${API}/recipes?count=${PAGE}&offset=${offset}`); } catch { break; }
    const entries = list.data?.entries || [];
    if (!entries.length) break;
    for (const e of entries) {
      if (!e.url || !largestImage(e.media)) continue;
      const slug = e.url.split('/').filter(Boolean).pop();
      if (!slug || seenSlug.has(slug) || existingSlugs.has(slug)) continue;
      const norm = normTitle(e.title);
      if (seenNorm.has(norm)) continue; // near-duplicate of something we have / already queued
      seenSlug.add(slug); seenNorm.add(norm);
      candidates.push({ slug, title: e.title, media: e.media, primary: primaryMeal(e.title) });
    }
    const bf = candidates.filter((c) => c.primary === 'breakfast').length;
    const ln = candidates.filter((c) => c.primary === 'lunch').length;
    // Stop early once we have plenty plus enough breakfast/lunch for the mix.
    if (candidates.length >= TARGET * 3 && bf >= bfTarget && ln >= lunchTarget) break;
    await sleep(35);
  }
  const poolByMeal = (m) => candidates.filter((c) => c.primary === m).length;
  console.log(`Found ${candidates.length} new candidates (breakfast ${poolByMeal('breakfast')}, lunch ${poolByMeal('lunch')}, dinner ${poolByMeal('dinner')}); library has ${existing.length}.\n`);

  const imported = [];
  const mealCount = { breakfast: 0, lunch: 0, dinner: 0 };

  async function attempt(c) {
    c.done = true;
    try {
      const detail = await getJson(`${API}/recipe/${c.slug}`);
      const e = detail.data?.entry || detail.data?.entries?.[0] || detail.data;
      if (!e || !e.ingredients?.length || !e.cooking_instructions?.length) return;
      const cuisine = e.cuisine?.title || 'Other';
      if ((cuisineCount[cuisine] || 0) >= MAX_PER_CUISINE) return;

      const ingredients = cleanIngredients(e.ingredients).map(parseIngredient);
      const steps = stepsFrom(e);
      if (!ingredients.length || !steps.length) return;
      const total = e.prep_times?.for_4 ?? e.prep_times?.for_2 ?? null;
      const category = e.categories?.[0]?.title || null;
      const meal_types = mealTypesFor(e.title, category, total, []);
      const recipe = {
        title: e.title.trim(), cuisine, category,
        description: stripHtml(e.description).split('\n')[0] || null,
        ingredients, steps,
        image_url: largestImage(e.media),
        prep_minutes: null,
        cook_minutes: total,
        difficulty: inferDifficulty(steps.length, total || 0), servings: 4, meal_types,
        tags: [...new Set((e.tags || []).map((t) => t.title).filter(Boolean))].slice(0, 6),
        source: 'Gousto', source_url: `https://www.gousto.co.uk/cookbook/recipes/${c.slug}`,
      };
      // Insert immediately so progress is durable — a crash/timeout mid-run
      // never loses work, and a re-run resumes (dedup skips what's saved).
      await pool.query(
        `INSERT INTO recipes (user_id, title, cuisine, category, description, ingredients, steps,
           image_url, image_is_generated, prep_minutes, cook_minutes, difficulty, servings,
           meal_types, tags, source, source_kind, source_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12,$13,$14,$15,'url',$16)`,
        [userId, recipe.title, recipe.cuisine, recipe.category, recipe.description, J(recipe.ingredients), J(recipe.steps),
         recipe.image_url, recipe.prep_minutes, recipe.cook_minutes, recipe.difficulty, recipe.servings, J(recipe.meal_types),
         J(recipe.tags), recipe.source, recipe.source_url]
      );
      cuisineCount[cuisine] = (cuisineCount[cuisine] || 0) + 1;
      mealCount[c.primary]++;
      imported.push(recipe);
      console.log(`• [${imported.length}] ${recipe.title.slice(0, 44)}  [${cuisine}/${meal_types.join('+')}]`);
      await sleep(60);
    } catch { /* skip failures (recipe simply not counted) */ }
  }

  // Pass 1 — honour the meal mix so dinner doesn't crowd out breakfast/lunch.
  for (const c of candidates) {
    if (imported.length >= TARGET) break;
    if (mealCount[c.primary] >= MEAL_TARGET[c.primary]) continue; // reserve for pass 2
    await attempt(c);
  }
  // Pass 2 — fill any remaining slots regardless of meal bucket.
  for (const c of candidates) {
    if (imported.length >= TARGET) break;
    if (!c.done) await attempt(c);
  }

  if (!imported.length) { console.log('\nNothing new to import — library is already up to date.'); await pool.end(); return; }

  const dist = { breakfast: 0, lunch: 0, dinner: 0 };
  imported.forEach((r) => r.meal_types.forEach((m) => { if (dist[m] !== undefined) dist[m]++; }));
  const cuisines = [...new Set(imported.map((r) => r.cuisine))].sort();
  console.log(`\n✅ Added ${imported.length} new Gousto recipes for ${DEMO_EMAIL}.`);
  console.log(`   Meal coverage — breakfast: ${dist.breakfast}, lunch: ${dist.lunch}, dinner: ${dist.dinner}`);
  console.log(`   ${cuisines.length} cuisines: ${cuisines.join(', ')}`);
  await pool.end();
}

run().catch((e) => { console.error('\nImport failed:', e); process.exit(1); });

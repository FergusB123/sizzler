// One-off importer: pull real recipes from Gousto's public cookbook API,
// normalise them through Sizzler's own Claude parser, re-host the hero image
// to Cloudinary, and write them into the demo user's library (replacing the
// placeholder seed recipes).
//   node server/import-gousto.cjs [count]
require('dotenv').config({ override: true });
const pool = require('./database');
const { initDatabase } = require('./database');
const { extractFromText } = require('./services/claude');

const TARGET = Number(process.argv[2]) || 10;
const MAX_PER_CUISINE = 2;
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

function buildContent(e) {
  const ingredients = cleanIngredients(e.ingredients);
  const basics = (e.basics || []).map((b) => b.title).filter(Boolean);
  const steps = (e.cooking_instructions || [])
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((s, i) => `${i + 1}. ${stripHtml(s.instruction)}`);
  return [
    `Recipe: ${e.title}`,
    e.description ? `Description: ${stripHtml(e.description)}` : '',
    e.cuisine?.title ? `Cuisine: ${e.cuisine.title}` : '',
    `Serves: 4`,
    e.prep_times?.for_4 ? `Total time: ${e.prep_times.for_4} minutes` : '',
    '',
    'Ingredients (for 4 servings):',
    ...ingredients.map((i) => `- ${i}`),
    ...(basics.length ? ['Store-cupboard basics:', ...basics.map((b) => `- ${b}`)] : []),
    '',
    'Method:',
    ...steps,
  ].filter((l) => l !== '').join('\n');
}

function largestImage(media) {
  const imgs = (media?.images || []).slice().sort((a, b) => (a.width || 0) - (b.width || 0));
  return imgs.length ? imgs[imgs.length - 1].image : null;
}

async function run() {
  await initDatabase();

  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL]);
  if (!userRows[0]) throw new Error(`Demo user ${DEMO_EMAIL} not found — run \`npm run seed\` first.`);
  const userId = userRows[0].id;

  // List candidates (more than we need, so we can pick a diverse spread).
  const list = await getJson(`${API}/recipes?count=80&page=1`);
  const candidates = (list.data?.entries || []).filter((e) => e.url && largestImage(e.media));
  console.log(`Fetched ${candidates.length} candidate recipes from Gousto.\n`);

  const cuisineCount = {};
  const imported = [];

  for (const c of candidates) {
    if (imported.length >= TARGET) break;
    const slug = c.url.split('/').filter(Boolean).pop();
    try {
      const detail = await getJson(`${API}/recipe/${slug}`);
      const e = detail.data?.entry || detail.data?.entries?.[0] || detail.data;
      if (!e || !e.ingredients?.length || !e.cooking_instructions?.length) { continue; }

      const cuisine = e.cuisine?.title || 'Other';
      if ((cuisineCount[cuisine] || 0) >= MAX_PER_CUISINE) continue;

      process.stdout.write(`• ${e.title}  [${cuisine}] … `);
      const parsed = await extractFromText(buildContent(e));
      if (!parsed?.title || parsed.title === 'NOT_A_RECIPE') { console.log('skipped (not parsed)'); continue; }

      // Use Gousto's public CDN image directly. Re-hosting only makes sense with
      // Cloudinary configured; without it we'd get local /uploads paths that break
      // on Vercel. The CDN URL is stable and resolves everywhere.
      const imageUrl = largestImage(e.media);

      const recipe = {
        title: e.title.trim(),
        cuisine,
        category: parsed.category || (e.categories?.[0]?.title) || null,
        description: parsed.description || stripHtml(e.description).split('\n')[0] || null,
        ingredients: parsed.ingredients || [],
        steps: parsed.steps || [],
        image_url: imageUrl,
        prep_minutes: parsed.prep_minutes ?? null,
        cook_minutes: parsed.cook_minutes ?? (e.prep_times?.for_4 ?? null),
        difficulty: parsed.difficulty || 'medium',
        servings: 4,
        meal_types: parsed.meal_types?.length ? parsed.meal_types : ['dinner'],
        tags: [...new Set([...(parsed.tags || []), ...((e.tags || []).map((t) => t.title).filter(Boolean))])].slice(0, 6),
        source: 'Gousto',
        source_url: `https://www.gousto.co.uk/cookbook/recipes/${slug}`,
      };

      cuisineCount[cuisine] = (cuisineCount[cuisine] || 0) + 1;
      imported.push(recipe);
      console.log(`ok (${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps)`);
      await sleep(400);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  if (!imported.length) throw new Error('Nothing imported — leaving existing recipes untouched.');

  // Atomic replace: wipe the demo library and insert the fresh batch together,
  // so a partial run can never leave the library empty or duplicated.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query('DELETE FROM recipes WHERE user_id = $1 RETURNING title', [userId]);
    for (const r of imported) {
      await client.query(
        `INSERT INTO recipes (user_id, title, cuisine, category, description, ingredients, steps,
           image_url, image_is_generated, prep_minutes, cook_minutes, difficulty, servings,
           meal_types, tags, source, source_kind, source_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12,$13,$14,$15,'url',$16)`,
        [userId, r.title, r.cuisine, r.category, r.description, J(r.ingredients), J(r.steps),
         r.image_url, r.prep_minutes, r.cook_minutes, r.difficulty, r.servings, J(r.meal_types),
         J(r.tags), r.source, r.source_url]
      );
    }
    await client.query('COMMIT');
    console.log(`\nReplaced ${old.length} old recipe(s): ${old.map((r) => r.title).join(', ') || '(none)'}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`\n✅ Imported ${imported.length} Gousto recipes for ${DEMO_EMAIL}:`);
  imported.forEach((r, i) => console.log(`  ${i + 1}. ${r.title} — ${r.cuisine} · ${(r.cook_minutes || '?')}min · ${r.meal_types.join('/')}`));
  await pool.end();
}

run().catch((e) => { console.error('\nImport failed:', e); process.exit(1); });

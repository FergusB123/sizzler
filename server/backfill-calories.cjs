// Backfill `calories` (kcal per portion) for recipes that don't have it.
//   node server/backfill-calories.cjs [--limit N] [--dry]
//
// Source of truth by recipe:
//   • Gousto  → real per-portion figure from Gousto's public API (authoritative).
//   • others  → estimated by Claude from the title, ingredients and servings.
// Idempotent: only touches rows where calories IS NULL, and writes incrementally.
require('dotenv').config({ override: true });
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('./database');
const { initDatabase } = require('./database');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const CONCURRENCY = 5;
const DRY = process.argv.includes('--dry');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || null;
const UA = 'Mozilla/5.0 (Sizzler importer)';
const GOUSTO = 'https://production-api.gousto.co.uk/cmsreadbroker/v1';

let anthropic;
const ai = () => (anthropic ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function goustoKcal(sourceUrl) {
  if (!sourceUrl) return null;
  const slug = sourceUrl.split('/').filter(Boolean).pop();
  if (!slug) return null;
  const r = await fetch(`${GOUSTO}/recipe/${slug}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) return null;
  const d = await r.json();
  const e = d.data?.entry || d.data;
  const kcal = e?.nutritional_information?.per_portion?.energy_kcal;
  return Number.isFinite(kcal) ? Math.round(kcal) : null;
}

const CAL_TOOL = {
  name: 'set_calories',
  description: 'Report the estimated energy per portion in kcal.',
  input_schema: {
    type: 'object',
    properties: { calories: { type: 'integer', description: 'Approximate kcal per single portion.' } },
    required: ['calories'],
  },
};

async function estimateKcal(recipe) {
  const ings = (recipe.ingredients || []).map((i) => i.raw || [i.quantity, i.unit, i.name].filter(Boolean).join(' ')).join('\n');
  const text = `Estimate the calories PER PORTION (kcal) for this dish.\n\n`
    + `Title: ${recipe.title}\nServings: ${recipe.servings || 4}\nIngredients:\n${ings}`;
  const res = await ai().messages.create({
    model: MODEL,
    max_tokens: 256,
    system: 'You are a nutrition estimator. Given a recipe, estimate realistic energy per single portion in kcal. Divide the total by the number of servings. Always answer via the set_calories tool.',
    tools: [CAL_TOOL],
    tool_choice: { type: 'tool', name: 'set_calories' },
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
  });
  const tool = res.content.find((b) => b.type === 'tool_use');
  const n = tool?.input?.calories;
  return Number.isFinite(n) ? Math.round(n) : null;
}

async function main() {
  await initDatabase(); // ensures the calories column exists
  let q = 'SELECT id, title, source, source_url, servings, ingredients FROM recipes WHERE calories IS NULL ORDER BY id';
  if (LIMIT) q += ` LIMIT ${LIMIT}`;
  const { rows } = await pool.query(q);
  console.log(`${rows.length} recipes need calories${DRY ? ' (DRY RUN)' : ''}\n`);

  let next = 0, gousto = 0, est = 0, failed = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= rows.length) return;
      const r = rows[i];
      try {
        let kcal = null, via = '';
        if (r.source === 'Gousto') {
          kcal = await goustoKcal(r.source_url);
          if (kcal) via = 'gousto';
        }
        if (!kcal) { kcal = await estimateKcal(r); via = 'estimate'; }
        if (!kcal) throw new Error('no value');
        if (!DRY) await pool.query('UPDATE recipes SET calories = $1 WHERE id = $2', [kcal, r.id]);
        via === 'gousto' ? gousto++ : est++;
        if ((gousto + est) % 25 === 0 || DRY) console.log(`[${gousto + est}/${rows.length}] ${r.title.slice(0, 40)} → ${kcal} kcal (${via})`);
        await sleep(30);
      } catch (e) { failed++; console.error(`✗ ${r.title.slice(0, 40)} — ${e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nDone. Gousto real: ${gousto}, estimated: ${est}, failed: ${failed}.`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

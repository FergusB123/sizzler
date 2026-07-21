// Import generated-recipes.json into the app, generating a Gemini photo for each.
//
//   node server/import-generated.cjs [--skip "Title A,Title B"]
//
// Images are written to client/public/recipe-images and referenced as
// /recipe-images/<slug>.jpg. That means Vercel serves them as static CDN assets
// (no Cloudinary needed, and they stay fast) — local /uploads paths would 404
// in production, and base64 data URLs would bloat every recipe query.
//
// Idempotent: skips recipes whose title already exists, and reuses any image
// file already on disk, so re-running after a crash costs nothing.
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'client', 'node_modules', 'sharp'));
const pool = require('./database');

const SRC = path.join(__dirname, 'generated-recipes.json');
const IMG_DIR = path.join(__dirname, '..', 'client', 'public', 'recipe-images');
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const CONCURRENCY = 2;   // keep well under Gemini rate limits
const MAX_RETRY = 3;

const J = (v) => JSON.stringify(v ?? []);
const norm = (t) => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s) => (s || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geminiImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const inline = parts.map((p) => p.inlineData || p.inline_data).find((d) => d?.data);
  if (!inline?.data) throw new Error('no image data returned');
  return Buffer.from(inline.data, 'base64');
}

// Full-size for the recipe hero + a 350px variant for cards (same trick we use
// for the Gousto thumbnails).
async function makeImage(r) {
  const name = slug(r.title);
  const full = path.join(IMG_DIR, `${name}.jpg`);
  const thumb = path.join(IMG_DIR, `${name}-350.jpg`);
  if (fs.existsSync(full) && fs.existsSync(thumb)) return `/recipe-images/${name}.jpg`;

  const prompt = `A professional overhead food photograph of "${r.title}". ${r.description || ''} `
    + `Plated on a ceramic plate or bowl on a clean surface, styled like a modern recipe website `
    + `(Gousto / HelloFresh): natural daylight, shallow depth of field, fresh garnish, vibrant and `
    + `appetising, photorealistic, high detail. No text, no logos, no hands.`;

  let buf, lastErr;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try { buf = await geminiImage(prompt); break; }
    catch (e) { lastErr = e; if (attempt < MAX_RETRY) await sleep(2500 * attempt); }
  }
  if (!buf) throw lastErr;

  await sharp(buf).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(full);
  await sharp(buf).resize(350, 350, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(thumb);
  return `/recipe-images/${name}.jpg`;
}

async function main() {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY is not set');
  fs.mkdirSync(IMG_DIR, { recursive: true });

  const skipArg = (process.argv.find((a) => a.startsWith('--skip=')) || '').replace('--skip=', '');
  const skipSet = new Set(skipArg.split(',').map(norm).filter(Boolean));

  const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));

  // Import into the account that already owns the library.
  const { rows: owners } = await pool.query(
    'SELECT user_id, COUNT(*)::int AS n FROM recipes GROUP BY user_id ORDER BY n DESC LIMIT 1');
  if (!owners.length) throw new Error('no existing recipes — cannot infer target user');
  const userId = owners[0].user_id;

  const { rows: existing } = await pool.query('SELECT title FROM recipes WHERE user_id = $1', [userId]);
  const have = new Set(existing.map((r) => norm(r.title)));

  const todo = all.filter((r) => !have.has(norm(r.title)) && !skipSet.has(norm(r.title)));
  console.log(`user ${userId} · ${existing.length} existing · ${todo.length} to import (${all.length - todo.length} skipped)\n`);

  let next = 0, ok = 0, failed = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= todo.length) return;
      const r = todo[i];
      try {
        const image_url = await makeImage(r);
        await pool.query(
          `INSERT INTO recipes (user_id, title, cuisine, category, description, ingredients, steps,
             image_url, image_is_generated, prep_minutes, cook_minutes, difficulty, servings,
             meal_types, tags, source, source_kind, source_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$10,$11,$12,$13,$14,'Sizzler','ai',NULL)`,
          [userId, r.title, r.cuisine, r.category, r.description, J(r.ingredients), J(r.steps),
           image_url, r.prep_minutes, r.cook_minutes, r.difficulty, r.servings,
           J(['dinner']), J(r.tags)]);
        ok++;
        console.log(`✓ [${ok + failed}/${todo.length}] ${r.title}`);
      } catch (e) {
        failed++;
        console.error(`✗ [${ok + failed}/${todo.length}] ${r.title} — ${e.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nImported ${ok}, failed ${failed}. Images in client/public/recipe-images`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

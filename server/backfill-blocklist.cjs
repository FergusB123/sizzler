// One-off: seed the deleted_recipes blocklist with recipes the user already
// deleted BEFORE tombstoning existed. We can reconstruct the Sizzler set
// precisely: generated-recipes.json holds all 100 originally-generated titles;
// any not currently in the library were deleted → blocklist them so re-running
// the generator never brings them back. (TheMealDB deletions can't be
// reconstructed — there was no import log — so those rely on not re-running
// that importer; future deletions of any source are now tombstoned live.)
//   node server/backfill-blocklist.cjs
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const pool = require('./database');
const { initDatabase } = require('./database');

const norm = (t) => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  await initDatabase(); // ensures deleted_recipes exists

  const { rows: owners } = await pool.query('SELECT user_id, COUNT(*)::int n FROM recipes GROUP BY user_id ORDER BY n DESC LIMIT 1');
  const userId = owners[0].user_id;

  const gen = JSON.parse(fs.readFileSync(path.join(__dirname, 'generated-recipes.json'), 'utf8'));
  const { rows: cur } = await pool.query('SELECT title FROM recipes WHERE user_id = $1', [userId]);
  const present = new Set(cur.map((r) => norm(r.title)));
  const { rows: already } = await pool.query('SELECT title FROM deleted_recipes WHERE user_id = $1', [userId]);
  const tombstoned = new Set(already.map((r) => norm(r.title)));

  const deletedTitles = [...new Set(gen.map((r) => r.title).filter(Boolean))]
    .filter((t) => !present.has(norm(t)) && !tombstoned.has(norm(t)));

  for (const t of deletedTitles) {
    await pool.query('INSERT INTO deleted_recipes (user_id, title, source) VALUES ($1,$2,$3)', [userId, t, 'Sizzler']);
  }
  console.log(`Blocklisted ${deletedTitles.length} previously-deleted Sizzler recipes.`);
  const { rows: tot } = await pool.query('SELECT COUNT(*)::int n FROM deleted_recipes WHERE user_id = $1', [userId]);
  console.log(`deleted_recipes now holds ${tot[0].n} entries for user ${userId}.`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

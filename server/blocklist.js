// Shared blocklist (tombstone) helper used by every importer so a recipe the
// user has deleted is never re-added. Returns the RAW deleted titles + urls;
// each importer applies its own title-normalisation when merging into its
// dedupe set (their norms differ slightly), plus source_url matching.
async function loadBlocklist(pool, userId) {
  try {
    const { rows } = await pool.query('SELECT title, source_url FROM deleted_recipes WHERE user_id = $1', [userId]);
    return {
      titles: rows.map((r) => r.title).filter(Boolean),
      urls: rows.map((r) => (r.source_url || '').replace(/\/+$/, '')).filter(Boolean),
    };
  } catch {
    return { titles: [], urls: [] }; // table may not exist yet on an old DB
  }
}

// Record recipes as deleted (call before actually removing the rows).
async function recordDeletions(pool, userId, recipes) {
  const rows = (recipes || []).filter((r) => r && r.title);
  for (const r of rows) {
    await pool.query(
      'INSERT INTO deleted_recipes (user_id, title, source, source_url) VALUES ($1,$2,$3,$4)',
      [userId, r.title, r.source || null, r.source_url || null]
    );
  }
  return rows.length;
}

module.exports = { loadBlocklist, recordDeletions };

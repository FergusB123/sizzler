// Replace recipe images with the photo from their original source page.
// For every recipe that has an EXTERNAL source_url (i.e. Claude-processed
// TheMealDB recipes whose source is a real recipe site), fetch the page, pull
// its og:image / JSON-LD image, and overwrite the stored static asset in place
// (same filename → no DB change, no orphans). On any failure the existing image
// is kept, so this is safe to re-run.
//
//   node server/refresh-source-images.cjs [--limit N] [--dry]
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const pool = require('./database');
const sharp = require(path.join(__dirname, '..', 'client', 'node_modules', 'sharp'));

const DRY = process.argv.includes('--dry');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || null;
const CONCURRENCY = 4;
const IMG_DIR = path.join(__dirname, '..', 'client', 'public', 'recipe-images');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractImage(html) {
  const meta = (prop) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    return tag?.match(/content=["']([^"']+)["']/i)?.[1] || null;
  };
  let img = meta('og:image') || meta('og:image:url') || meta('twitter:image') || meta('twitter:image:src');
  if (img) return img;
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1].trim());
      const nodes = Array.isArray(data) ? data : (data['@graph'] || [data]);
      for (const n of nodes) {
        const t = n['@type'];
        if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) {
          const im = n.image;
          if (typeof im === 'string') return im;
          if (Array.isArray(im)) return typeof im[0] === 'string' ? im[0] : im[0]?.url;
          if (im?.url) return im.url;
        }
      }
    } catch { /* ignore */ }
  }
  return null;
}

// Keep the source's landscape framing, just enlarge small ones. (Do NOT strip
// immediate.co.uk's ?resize= — without it that CDN returns a square default.)
function upgradeUrl(u) {
  try {
    const url = new URL(u);
    if (url.hostname.includes('immediate.co.uk')) {
      const rs = url.searchParams.get('resize');
      const m = rs && rs.match(/^(\d+)[,x](\d+)$/);
      if (m) {
        let w = +m[1], h = +m[2];
        if (w && w < 1000) { const f = 1000 / w; url.searchParams.set('resize', `${Math.round(w * f)},${Math.round(h * f)}`); }
      } else {
        url.searchParams.set('resize', '1200,675'); // sensible landscape, not the square default
      }
    }
    return url.toString();
  } catch { return u; }
}

async function fetchText(url, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return { status: r.status };
    return { status: 200, html: await r.text() };
  } catch (e) { return { err: e.message }; } finally { clearTimeout(t); }
}

async function fetchBuffer(url, ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return { status: r.status };
    const ct = r.headers.get('content-type') || '';
    if (!/image\//i.test(ct)) return { err: `not an image (${ct})` };
    return { buf: Buffer.from(await r.arrayBuffer()) };
  } catch (e) { return { err: e.message }; } finally { clearTimeout(t); }
}

async function main() {
  let q = `SELECT id, title, source_url, image_url FROM recipes
           WHERE source_url IS NOT NULL AND source_url NOT ILIKE '%themealdb.com%'
             AND source = 'TheMealDB' ORDER BY id`;
  if (LIMIT) q += ` LIMIT ${LIMIT}`;
  const { rows } = await pool.query(q);
  console.log(`${rows.length} recipes with an external source_url${DRY ? ' (DRY RUN)' : ''}\n`);

  let next = 0, replaced = 0, kept = 0;
  const keeps = {};
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= rows.length) return;
      const r = rows[i];
      const keep = (why) => { kept++; keeps[why] = (keeps[why] || 0) + 1; if (DRY) console.log(`· keep ${r.title.slice(0, 36)} — ${why}`); };
      try {
        const page = await fetchText(r.source_url);
        if (page.err || page.status !== 200) { keep(`page ${page.status || page.err}`); continue; }
        let imgUrl = extractImage(page.html);
        if (!imgUrl) { keep('no image on page'); continue; }
        imgUrl = upgradeUrl(new URL(imgUrl, r.source_url).toString());

        if (DRY) { console.log(`✓ would replace [${r.id}] ${r.title.slice(0, 34)}  ←  ${imgUrl.slice(0, 70)}`); replaced++; continue; }

        const dl = await fetchBuffer(imgUrl);
        if (dl.err || dl.status) { keep(`img ${dl.status || dl.err}`); continue; }
        const meta = await sharp(dl.buf).metadata();
        if ((meta.width || 0) < 300 || (meta.height || 0) < 200) { keep(`too small ${meta.width}x${meta.height}`); continue; }

        const base = path.basename(r.image_url || `recipe-${r.id}.jpg`).replace(/\.jpg$/i, '');
        const full = path.join(IMG_DIR, `${base}.jpg`);
        const thumb = path.join(IMG_DIR, `${base}-350.jpg`);
        await sharp(dl.buf).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(full);
        await sharp(dl.buf).resize(350, 350, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(thumb);
        // image_url path is unchanged (same slug); make sure it's flagged real.
        await pool.query('UPDATE recipes SET image_url = $1, image_is_generated = FALSE WHERE id = $2', [`/recipe-images/${base}.jpg`, r.id]);
        replaced++;
        if (replaced % 20 === 0) console.log(`  …${replaced} replaced`);
        await sleep(50);
      } catch (e) { keep(`error ${e.message.slice(0, 40)}`); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n${DRY ? 'Would replace' : 'Replaced'} ${replaced}, kept existing ${kept}.`);
  if (Object.keys(keeps).length) console.log('kept reasons:', JSON.stringify(keeps));
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const { extractFromText, extractFromImages } = require('../services/claude');
const { uploadFile } = require('../services/storage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const UA = 'Mozilla/5.0 (compatible; SizzlerBot/1.0; +https://sizzler.app) AppleWebKit/537.36';
const SOCIAL_HOSTS = ['tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be', 'facebook.com', 'pinterest.'];

// Pull the page's hero image (og:image / twitter:image / JSON-LD image),
// download it and store it via Cloudinary (or local /uploads in dev). Returns a
// stored URL or null — always best-effort, never blocks the import.
function findImageUrl(html, pageUrl) {
  let src = metaContent(html, 'og:image') || metaContent(html, 'og:image:secure_url') || metaContent(html, 'twitter:image');
  if (!src) {
    const m = html.match(/"image"\s*:\s*"([^"]+)"/i) || html.match(/"image"\s*:\s*\[\s*"([^"]+)"/i);
    if (m) src = m[1];
  }
  if (!src) return null;
  try { return new URL(src, pageUrl).href; } catch { return null; }
}

async function storeRemoteImage(imageUrl) {
  try {
    const res = await fetch(imageUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) return null; // skip 1x1 trackers / empties
    const ext = (type.split('/')[1] || 'jpg').split(';')[0];
    return await uploadFile(buf, `import.${ext}`, type);
  } catch { return null; }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}
function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]).filter((t) => /recipe/i.test(t));
  return blocks.join('\n').slice(0, 12000);
}
function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  return html.match(re)?.[1] ?? null;
}

function recipeOrError(recipe, res) {
  if (!recipe || recipe.title === 'NOT_A_RECIPE') {
    res.status(422).json({ error: 'no_recipe', message: "We couldn't find a recipe in that." });
    return false;
  }
  return true;
}

// ---- manual text paste ----
router.post('/text', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Provide text' });
    const recipe = await extractFromText(text);
    if (recipeOrError(recipe, res)) res.json({ recipe });
  } catch (err) { res.status(500).json({ error: 'extract_failed', message: err.message }); }
});

// ---- photo (vision) ----
router.post('/photo', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Provide an image' });
    const recipe = await extractFromImages([{ buffer: req.file.buffer, mimetype: req.file.mimetype }]);
    if (recipeOrError(recipe, res)) res.json({ recipe });
  } catch (err) { res.status(500).json({ error: 'extract_failed', message: err.message }); }
});

// ---- URL / social (best-effort) ----
router.post('/url', auth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'bad_url' });
    const host = new URL(url).hostname.replace('www.', '');
    const isSocial = SOCIAL_HOSTS.some((h) => host.includes(h));

    let html = '';
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
      if (!r.ok) throw new Error(`status ${r.status}`);
      html = await r.text();
    } catch {
      return res.status(422).json({
        error: 'fetch_failed',
        message: isSocial
          ? "We couldn't read that social link — these often block automated access. Try pasting the recipe text manually."
          : "We couldn't reach that page. Check the link or paste the recipe text manually.",
      });
    }

    let content = '';
    const jsonLd = extractJsonLd(html);
    if (jsonLd) content += `JSON-LD:\n${jsonLd}\n\n`;
    if (isSocial) {
      const caption = metaContent(html, 'og:description') || metaContent(html, 'description');
      const title = metaContent(html, 'og:title');
      content += `Social post from ${host}.\nTitle: ${title ?? ''}\nCaption: ${caption ?? ''}`;
      if (!caption && !jsonLd) {
        return res.status(422).json({ error: 'no_content', message: "We couldn't read this link's caption. Try pasting the recipe text manually." });
      }
    } else {
      content += stripHtml(html).slice(0, 14000);
    }

    const recipe = await extractFromText(content);
    if (!recipeOrError(recipe, res)) return;

    // Best-effort: grab the page's hero image and store it.
    const remote = findImageUrl(html, url);
    const image_url = remote ? await storeRemoteImage(remote) : null;

    res.json({ recipe, image_url, source_url: url, source_kind: isSocial ? 'social' : 'url' });
  } catch (err) { res.status(500).json({ error: 'import_failed', message: err.message }); }
});

module.exports = router;

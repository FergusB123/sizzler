// Build a self-contained HTML preview of generated-recipes.json for review
// before importing. Writes the page to the path given as argv[2].
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'generated-recipes.json');
const OUT = process.argv[2] || path.join(__dirname, 'recipe-preview.html');

const recipes = JSON.parse(fs.readFileSync(SRC, 'utf8'))
  .map((r, i) => ({
    id: i,
    title: r.title,
    cuisine: r.cuisine || r._cuisineHint || 'Other',
    category: r.category || '',
    description: r.description || '',
    prep: r.prep_minutes || 0,
    cook: r.cook_minutes || 0,
    serves: r.servings || null,
    difficulty: r.difficulty || '',
    tags: r.tags || [],
    ingredients: (r.ingredients || []).map((x) => ({
      q: (x.quantity || '').toString().trim(),
      u: (x.unit || '').trim(),
      n: (x.name || x.raw || '').trim(),
    })),
    steps: r.steps || [],
  }))
  .sort((a, b) => a.cuisine.localeCompare(b.cuisine) || a.title.localeCompare(b.title));

const cuisines = [...new Set(recipes.map((r) => r.cuisine))].sort();
const totalMin = recipes.map((r) => r.prep + r.cook);
const avgTime = Math.round(totalMin.reduce((a, b) => a + b, 0) / recipes.length);
const quickest = Math.min(...totalMin);
const longest = Math.max(...totalMin);

const DATA = JSON.stringify(recipes).replace(/</g, '\\u003c');

const html = `<title>50 new recipes for Sizzler</title>
<style>
  :root {
    --ground: #FBF5EC;
    --surface: #FFFFFF;
    --surface-2: #F4EDE1;
    --ink: #1B1916;
    --ink-2: #554F47;
    --ink-3: #8A8377;
    --line: #E5DACA;
    --flame: #EB4606;
    --ember: #A8480B;
    --radius: 14px;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground: #141210; --surface: #1E1B18; --surface-2: #262119;
      --ink: #F4EDE2; --ink-2: #C4BAAC; --ink-3: #918878; --line: #332C24;
      --flame: #FF6A33; --ember: #E8912A; color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --ground: #141210; --surface: #1E1B18; --surface-2: #262119;
    --ink: #F4EDE2; --ink-2: #C4BAAC; --ink-3: #918878; --line: #332C24;
    --flame: #FF6A33; --ember: #E8912A; color-scheme: dark;
  }
  :root[data-theme="light"] {
    --ground: #FBF5EC; --surface: #FFFFFF; --surface-2: #F4EDE1;
    --ink: #1B1916; --ink-2: #554F47; --ink-3: #8A8377; --line: #E5DACA;
    --flame: #EB4606; --ember: #A8480B; color-scheme: light;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--ground); color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 40px 20px 72px; }

  .eyebrow {
    font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--flame); margin-bottom: 10px;
  }
  h1 {
    font-size: clamp(30px, 5vw, 46px); line-height: 1.02; letter-spacing: -0.035em;
    font-weight: 800; margin: 0 0 12px; text-wrap: balance;
  }
  .lede { color: var(--ink-2); max-width: 60ch; margin: 0 0 26px; font-size: 16.5px; }

  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 30px; }
  .stat {
    background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
    padding: 11px 15px; min-width: 104px;
  }
  .stat b {
    display: block; font-size: 21px; letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }
  .stat span { font-size: 11.5px; color: var(--ink-3); letter-spacing: 0.03em; text-transform: uppercase; font-weight: 600; }

  .controls {
    position: sticky; top: 0; z-index: 20; background: var(--ground);
    padding: 12px 0 14px; border-bottom: 1px solid var(--line); margin-bottom: 22px;
  }
  .search {
    width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--line);
    background: var(--surface); color: var(--ink); font: inherit; font-size: 15px; margin-bottom: 11px;
  }
  .search::placeholder { color: var(--ink-3); }
  .search:focus-visible { outline: 2px solid var(--flame); outline-offset: 1px; }
  .chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .chip {
    border: 1px solid var(--line); background: var(--surface); color: var(--ink-2);
    border-radius: 999px; padding: 6px 13px; font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: background .15s, color .15s, border-color .15s;
  }
  .chip:hover { border-color: var(--ink-3); }
  .chip[aria-pressed="true"] { background: var(--flame); border-color: var(--flame); color: #fff; }
  .chip:focus-visible { outline: 2px solid var(--flame); outline-offset: 2px; }

  .count { font-size: 13px; color: var(--ink-3); margin: 16px 0 12px; font-variant-numeric: tabular-nums; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
  .card {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 17px 17px 15px; text-align: left; cursor: pointer; font: inherit; color: inherit;
    display: flex; flex-direction: column; gap: 9px; transition: border-color .15s, transform .12s;
  }
  .card:hover { border-color: var(--flame); }
  .card:active { transform: scale(.995); }
  .card:focus-visible { outline: 2px solid var(--flame); outline-offset: 2px; }
  .card.out { opacity: .38; }
  .card-top { display: flex; align-items: center; gap: 8px; }
  .cuisine {
    font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
    color: var(--ember); background: var(--surface-2); padding: 4px 9px; border-radius: 999px;
  }
  .card h3 { margin: 0; font-size: 17.5px; line-height: 1.22; letter-spacing: -0.015em; font-weight: 700; text-wrap: balance; }
  .card p { margin: 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }
  .meta {
    display: flex; gap: 12px; margin-top: auto; padding-top: 4px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px;
    color: var(--ink-3); font-variant-numeric: tabular-nums;
  }
  .skip {
    align-self: flex-start; margin-top: 2px; background: none; border: none; padding: 4px 0;
    font: inherit; font-size: 12px; font-weight: 600; color: var(--ink-3); cursor: pointer;
    text-decoration: underline; text-underline-offset: 3px;
  }
  .skip:hover { color: var(--flame); }

  dialog {
    border: none; padding: 0; border-radius: 16px; max-width: 640px; width: calc(100% - 32px);
    background: var(--surface); color: var(--ink); max-height: 86dvh; overflow: auto;
  }
  dialog::backdrop { background: rgba(20, 16, 12, .55); backdrop-filter: blur(2px); }
  .sheet { padding: 26px 26px 30px; }
  .sheet h2 { margin: 8px 0 8px; font-size: 25px; line-height: 1.08; letter-spacing: -0.025em; text-wrap: balance; }
  .sheet .desc { color: var(--ink-2); font-size: 14.5px; margin: 0 0 18px; }
  .facts {
    display: flex; gap: 18px; flex-wrap: wrap; padding: 13px 0; margin-bottom: 20px;
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12.5px;
    color: var(--ink-2); font-variant-numeric: tabular-nums;
  }
  .facts b { color: var(--ink); }
  h4 {
    margin: 0 0 11px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--flame);
  }
  .ings { list-style: none; margin: 0 0 24px; padding: 0; }
  .ings li {
    display: grid; grid-template-columns: 72px 1fr; gap: 12px; align-items: baseline;
    padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 14.5px;
  }
  .ings .amt {
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12.5px;
    color: var(--ink-3); font-variant-numeric: tabular-nums;
  }
  .steps { margin: 0; padding: 0; list-style: none; counter-reset: s; }
  .steps li {
    counter-increment: s; display: grid; grid-template-columns: 26px 1fr; gap: 12px;
    margin-bottom: 14px; font-size: 14.5px; line-height: 1.55;
  }
  .steps li::before {
    content: counter(s); width: 26px; height: 26px; border-radius: 50%;
    background: var(--surface-2); color: var(--ember); font-weight: 700; font-size: 12.5px;
    display: grid; place-content: center;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }
  .close {
    position: sticky; top: 0; float: right; background: var(--surface-2); border: none;
    width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: var(--ink-2);
    font-size: 18px; line-height: 1; font-family: inherit;
  }
  .close:hover { color: var(--flame); }
  .empty { color: var(--ink-3); padding: 40px 0; text-align: center; }
  .note {
    margin-top: 34px; padding: 16px 18px; border-radius: 12px;
    background: var(--surface-2); border: 1px solid var(--line);
    font-size: 13.5px; color: var(--ink-2); line-height: 1.55;
  }
  .note b { color: var(--ink); }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>

<div class="wrap">
  <div class="eyebrow">Sizzler · library expansion</div>
  <h1>50 new recipes, ready for review</h1>
  <p class="lede">
    Original recipes written for Sizzler across twelve cuisines — weighted towards the
    Italian, French, Greek and comfort cooking you asked for. Tap any card for the full
    ingredients and method. Mark anything you don't want and I'll leave it out of the import.
  </p>

  <div class="stats">
    <div class="stat"><b>${recipes.length}</b><span>Recipes</span></div>
    <div class="stat"><b>${cuisines.length}</b><span>Cuisines</span></div>
    <div class="stat"><b>${avgTime}m</b><span>Avg time</span></div>
    <div class="stat"><b>${quickest}–${longest}m</b><span>Range</span></div>
    <div class="stat"><b id="keepCount">${recipes.length}</b><span>To import</span></div>
  </div>

  <div class="controls">
    <input class="search" id="q" type="search" placeholder="Search recipes, ingredients or tags…" aria-label="Search recipes" />
    <div class="chips" id="chips" role="group" aria-label="Filter by cuisine">
      <button class="chip" type="button" data-c="all" aria-pressed="true">All</button>
      ${cuisines.map((c) => `<button class="chip" type="button" data-c="${c}" aria-pressed="false">${c}</button>`).join('\n      ')}
    </div>
  </div>

  <div class="count" id="count"></div>
  <div class="grid" id="grid"></div>

  <div class="note">
    <b>What happens next.</b> On your go-ahead these get imported into Sizzler as dinners, and
    each one has a photo generated for it — the same pipeline that made the risotto shot. Nothing
    is added until you say so, and anything you've marked "skip" is left out.
  </div>
</div>

<dialog id="dlg"><div class="sheet" id="sheet"></div></dialog>

<script>
  const RECIPES = ${DATA};
  const skipped = new Set();
  let cuisine = 'all', query = '';

  const grid = document.getElementById('grid');
  const countEl = document.getElementById('count');
  const keepEl = document.getElementById('keepCount');
  const dlg = document.getElementById('dlg');
  const sheet = document.getElementById('sheet');

  const time = (r) => { const t = r.prep + r.cook; return t ? t + ' min' : '—'; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function visible() {
    const q = query.trim().toLowerCase();
    return RECIPES.filter((r) => {
      if (cuisine !== 'all' && r.cuisine !== cuisine) return false;
      if (!q) return true;
      const hay = (r.title + ' ' + r.cuisine + ' ' + r.category + ' ' + r.description + ' ' +
        r.tags.join(' ') + ' ' + r.ingredients.map((i) => i.n).join(' ')).toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const list = visible();
    countEl.textContent = list.length + (list.length === 1 ? ' recipe' : ' recipes') +
      (cuisine === 'all' ? '' : ' · ' + cuisine);
    keepEl.textContent = RECIPES.length - skipped.size;
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<p class="empty">Nothing matches that search.</p>';
      return;
    }
    for (const r of list) {
      const card = document.createElement('div');
      card.className = 'card' + (skipped.has(r.id) ? ' out' : '');
      card.innerHTML =
        '<div class="card-top"><span class="cuisine">' + esc(r.cuisine) + '</span></div>' +
        '<h3>' + esc(r.title) + '</h3>' +
        '<p>' + esc(r.description) + '</p>' +
        '<div class="meta"><span>' + time(r) + '</span><span>serves ' + (r.serves || '—') + '</span>' +
        '<span>' + r.ingredients.length + ' ingredients</span></div>';

      const open = document.createElement('button');
      open.className = 'card';
      open.style.cssText = 'all:unset';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('click', (e) => { if (!e.target.classList.contains('skip')) show(r); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(r); } });

      const skip = document.createElement('button');
      skip.className = 'skip';
      skip.type = 'button';
      skip.textContent = skipped.has(r.id) ? 'Skipped — undo' : 'Skip this one';
      skip.addEventListener('click', (e) => {
        e.stopPropagation();
        skipped.has(r.id) ? skipped.delete(r.id) : skipped.add(r.id);
        render();
      });
      card.appendChild(skip);
      grid.appendChild(card);
    }
  }

  function show(r) {
    sheet.innerHTML =
      '<button class="close" type="button" aria-label="Close">×</button>' +
      '<span class="cuisine">' + esc(r.cuisine) + (r.category ? ' · ' + esc(r.category) : '') + '</span>' +
      '<h2>' + esc(r.title) + '</h2>' +
      '<p class="desc">' + esc(r.description) + '</p>' +
      '<div class="facts"><span>Prep <b>' + r.prep + 'm</b></span><span>Cook <b>' + r.cook + 'm</b></span>' +
      '<span>Total <b>' + (r.prep + r.cook) + 'm</b></span><span>Serves <b>' + (r.serves || '—') + '</b></span></div>' +
      '<h4>Ingredients</h4><ul class="ings">' +
      r.ingredients.map((i) => '<li><span class="amt">' + esc([i.q, i.u].filter(Boolean).join(' ') || '—') +
        '</span><span>' + esc(i.n) + '</span></li>').join('') +
      '</ul><h4>Method</h4><ol class="steps">' +
      r.steps.map((s) => '<li><span>' + esc(s) + '</span></li>').join('') + '</ol>';
    sheet.querySelector('.close').addEventListener('click', () => dlg.close());
    dlg.showModal();
    dlg.scrollTop = 0;
  }

  document.getElementById('chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    cuisine = b.dataset.c;
    [...document.querySelectorAll('.chip')].forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    render();
  });
  document.getElementById('q').addEventListener('input', (e) => { query = e.target.value; render(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  render();
</script>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('wrote', OUT, `(${(html.length / 1024).toFixed(0)} KB, ${recipes.length} recipes)`);

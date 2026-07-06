// Build a categorised, de-duplicated shopping list from a plan's filled slots.
// Pure + deterministic so it can run client-side (no extra AI round-trip needed
// for categorisation — a keyword map covers the common supermarket aisles).

export const CATEGORIES = [
  { key: 'produce', label: 'Produce', icon: '🥬' },
  { key: 'meat_fish', label: 'Meat & Fish', icon: '🥩' },
  { key: 'dairy', label: 'Dairy & Eggs', icon: '🧀' },
  { key: 'bakery', label: 'Bakery', icon: '🥖' },
  { key: 'dry_goods', label: 'Tinned & Dry Goods', icon: '🥫' },
  { key: 'frozen', label: 'Frozen', icon: '🧊' },
  { key: 'herbs_spices', label: 'Herbs & Spices', icon: '🌿' },
  { key: 'other', label: 'Other', icon: '🛒' },
]

const KEYWORDS = {
  produce: ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'pepper', 'lettuce', 'spinach', 'kale', 'cucumber', 'lemon', 'lime', 'apple', 'banana', 'avocado', 'mushroom', 'courgette', 'zucchini', 'broccoli', 'celery', 'ginger', 'chilli', 'lime', 'orange', 'berries', 'salad', 'leek', 'cabbage', 'corn', 'aubergine', 'eggplant', 'spring onion', 'scallion'],
  meat_fish: ['chicken', 'beef', 'pork', 'lamb', 'mince', 'bacon', 'sausage', 'salmon', 'tuna', 'cod', 'prawn', 'shrimp', 'fish', 'turkey', 'ham', 'steak', 'chorizo', 'anchovy'],
  dairy: ['milk', 'butter', 'cheese', 'yogurt', 'yoghurt', 'cream', 'egg', 'parmesan', 'mozzarella', 'feta', 'creme fraiche', 'mascarpone', 'ricotta'],
  bakery: ['bread', 'bun', 'roll', 'baguette', 'tortilla', 'wrap', 'pitta', 'naan', 'croissant', 'bagel', 'brioche'],
  dry_goods: ['pasta', 'rice', 'flour', 'sugar', 'oil', 'vinegar', 'tin', 'tinned', 'can ', 'beans', 'lentil', 'chickpea', 'stock', 'noodle', 'sauce', 'paste', 'honey', 'oats', 'cereal', 'coconut milk', 'passata', 'couscous', 'quinoa', 'breadcrumb', 'soy sauce', 'mustard', 'ketchup', 'mayonnaise', 'tomato puree'],
  frozen: ['frozen', 'peas', 'ice cream', 'fish finger'],
  herbs_spices: ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme', 'rosemary', 'coriander', 'cinnamon', 'turmeric', 'curry powder', 'chilli powder', 'parsley', 'bay leaf', 'nutmeg', 'cardamom', 'saffron', 'dill', 'mint', 'spice', 'cayenne', 'garam masala'],
}

export function categorise(name) {
  const n = name.toLowerCase()
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => n.includes(w))) return cat
  }
  return 'other'
}

// Normalise an ingredient name for dedupe (drop quantities, plurals, descriptors).
function keyFor(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\b(fresh|dried|chopped|sliced|diced|minced|ground|large|small|medium|ripe|free-range|finely|roughly)\b/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '')
}

// Combine quantities into a { quantity, unit } pair for consistent columns.
// Sums same-unit amounts; falls back to a combined amount string (in quantity,
// with no separate unit) only when units genuinely differ.
// Parse "1/2", "1 1/2", "0.5", "2" into a number.
function toNum(q) {
  const s = String(q ?? '').trim()
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) return +mixed[1] + +mixed[2] / +mixed[3]
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) return +frac[1] / +frac[2]
  return parseFloat(s)
}

function combineAmounts(parts) {
  const byUnit = {}
  const freeform = []
  for (const p of parts) {
    const qty = toNum(p.quantity)
    const unit = (p.unit || '').toLowerCase().trim()
    if (!isNaN(qty)) {
      byUnit[unit] = (byUnit[unit] || 0) + qty // unit may be '' (a plain count)
    } else if (p.quantity) {
      freeform.push([p.quantity, p.unit].filter(Boolean).join(' '))
    }
  }
  const units = Object.keys(byUnit)
  if (units.length === 1 && !freeform.length) {
    return { quantity: String(+byUnit[units[0]].toFixed(2)), unit: units[0] }
  }
  const summed = units.map((u) => `${+byUnit[u].toFixed(2)}${u ? ' ' + u : ''}`)
  return { quantity: [...summed, ...freeform].join(' + '), unit: '' }
}

const UNIT_RE = /^(g|kg|ml|l|tbsp|tbsps|tsp|tsps|tin|tins|can|cans|clove|cloves|pack|packs|bunch|bunches|handful|handfuls|pinch|pinches|slice|slices|cup|cups|sprig|sprigs|stick|sticks|piece|pieces|pcs|ball|balls|sheet|sheets|jar|jars|bottle|bottles|knob|knobs|dash|drizzle|litre|litres|gram|grams)$/i
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Parse an amount token like "150g", "2pcs", "0.5 tbsp", "2", "1/2 tsp".
function parseAmountToken(tok) {
  const m = String(tok || '').trim().match(/^(\d+(?:\s*[/-]\s*\d+)?(?:\.\d+)?|½|¼|¾)\s*([a-z]+)?/i)
  if (!m) return null
  return { quantity: m[1].replace(/\s+/g, ''), unit: (m[2] || '').toLowerCase() }
}

// Pull a LEADING amount out of "1 carrot", "500g beef mince", "1 tin of tomatoes".
function splitLeading(str) {
  const s = String(str || '').trim()
  const m = s.match(/^(\d+(?:\s*[/-]\s*\d+)?(?:\.\d+)?|½|¼|¾)\s+(.*)$/)
  if (!m) return { amount: null, name: s }
  let rest = m[2]
  let unit = ''
  const first = rest.split(/\s+/)[0]
  if (first && UNIT_RE.test(first.replace(/[^a-z]/gi, ''))) { unit = first.toLowerCase(); rest = rest.slice(first.length).trim() }
  rest = rest.replace(/^of\s+/i, '')
  return { amount: { quantity: m[1].replace(/\s+/g, ''), unit }, name: rest || s }
}

// Normalise one ingredient into a clean { name, quantity, unit }. Handles
// structured fields, a trailing "(150g)"/"(2pcs)" amount, a Gousto "xN" portion
// multiplier, and leading amounts like "1 carrot".
function normaliseIngredient(ing) {
  let name = (ing.name || ing.raw || '').trim()
  let mult = 1
  const mx = name.match(/\s*[x×]\s*(\d+)\s*$/i)
  if (mx) { mult = parseInt(mx[1], 10) || 1; name = name.slice(0, mx.index).trim() }

  let amount = null
  const par = name.match(/\(([^)]+)\)\s*$/)
  if (par) { amount = parseAmountToken(par[1]); name = name.slice(0, par.index).trim() }

  if (!amount && ing.quantity != null && String(ing.quantity).trim() !== '') {
    amount = { quantity: String(ing.quantity).trim(), unit: (ing.unit || '').trim() }
  }
  if (!amount) {
    const lead = splitLeading(name)
    if (lead.amount) { amount = lead.amount; name = lead.name }
  }

  let quantity = '', unit = ''
  if (amount) {
    const n = toNum(amount.quantity)
    if (!isNaN(n)) { quantity = String(+(n * mult).toFixed(2)); unit = amount.unit }
    else { quantity = amount.quantity; unit = amount.unit }
  } else if (mult > 1) {
    quantity = String(mult)
  }
  return { name: cap(name), quantity, unit }
}

// Has the plan changed since this shopping list was built? Compares the set of
// recipes currently on the plan with the set the list was generated from (via
// each item's `from_recipes`). Manual items are ignored. Returns false when
// there's no real list yet, so callers can treat it as "nothing to update".
export function shoppingListStale(slots, items) {
  const generated = (items || []).filter((i) => !i.manual)
  if (generated.length === 0) return false
  const covered = new Set(generated.flatMap((i) => (i.from_recipes || []).map(Number)))
  const current = new Set((slots || []).filter((s) => s.recipe_id).map((s) => Number(s.recipe_id)))
  if (current.size === 0) return false
  for (const id of current) if (!covered.has(id)) return true
  for (const id of covered) if (!current.has(id)) return true
  return false
}

/**
 * @param {Array} slots  plan_slots joined with `recipe`
 * @returns {Array} shopping_list_items rows (without ids — caller persists)
 */
export function buildShoppingList(slots) {
  const groups = {} // key -> { name, parts[], recipeIds:Set, category }
  for (const slot of slots) {
    const recipe = slot.recipe
    if (!recipe) continue
    for (const ing of recipe.ingredients || []) {
      const norm = normaliseIngredient(ing)
      const k = keyFor(norm.name)
      if (!k) continue
      if (!groups[k]) groups[k] = { name: norm.name, parts: [], recipeIds: new Set(), category: categorise(norm.name) }
      groups[k].parts.push({ quantity: norm.quantity, unit: norm.unit })
      groups[k].recipeIds.add(recipe.id)
    }
  }
  return Object.values(groups)
    .map((g) => {
      const { quantity, unit } = combineAmounts(g.parts)
      return {
        name: g.name,
        quantity,
        unit,
        category: g.category,
        from_recipes: [...g.recipeIds],
        have_at_home: false,
        in_cart: false,
        manual: false,
      }
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

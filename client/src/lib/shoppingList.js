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

// Try to add two quantities of the same unit; otherwise list them.
function combineQuantities(parts) {
  const byUnit = {}
  const freeform = []
  for (const p of parts) {
    const qty = parseFloat(p.quantity)
    const unit = (p.unit || '').toLowerCase().trim()
    if (!isNaN(qty) && unit) {
      byUnit[unit] = (byUnit[unit] || 0) + qty
    } else if (p.quantity) {
      freeform.push([p.quantity, p.unit].filter(Boolean).join(' '))
    }
  }
  const summed = Object.entries(byUnit).map(([u, q]) => `${+q.toFixed(2)} ${u}`)
  return [...summed, ...freeform].join(' + ') || null
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
      const k = keyFor(ing.name || ing.raw || '')
      if (!k) continue
      if (!groups[k]) groups[k] = { name: ing.name || ing.raw, parts: [], recipeIds: new Set(), category: categorise(ing.name || ing.raw) }
      groups[k].parts.push({ quantity: ing.quantity, unit: ing.unit })
      groups[k].recipeIds.add(recipe.id)
    }
  }
  return Object.values(groups)
    .map((g) => ({
      name: g.name,
      quantity: combineQuantities(g.parts),
      category: g.category,
      from_recipes: [...g.recipeIds],
      have_at_home: false,
      in_cart: false,
      manual: false,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

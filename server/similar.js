// Near-duplicate ("same dish") detection for importers, so we don't add e.g.
// both "Pad Thai" and "Authentic Prawn Pad Thai". Reduces a title to its
// significant dish tokens (dropping marketing words, cooking methods, sizes,
// connectors — but KEEPING proteins and dish names so "chicken curry" and
// "beef curry" stay distinct), then treats two dishes as the same when one
// token-set contains the other (with a 2-token floor so generic single words
// like "curry" don't swallow everything).

const QUALIFIERS = new Set([
  // connectors / articles
  'the', 'a', 'an', 'of', 'with', 'and', 'in', 'on', 'for', 'to', 'my', 'our', 'your', 'n',
  // marketing / vibe
  'authentic', 'classic', 'easy', 'easiest', 'simple', 'quick', 'quickest', 'best', 'ultimate',
  'homemade', 'proper', 'real', 'perfect', 'favourite', 'favorite', 'family', 'midweek', 'super',
  'next', 'level', 'no', 'fuss', 'amazing', 'delicious', 'incredible', 'showstopper',
  // texture / flavour adjectives
  'creamy', 'spicy', 'sticky', 'crispy', 'smoky', 'sweet', 'fiery', 'zesty', 'hearty', 'warm',
  'golden', 'rich', 'tangy', 'fresh', 'light', 'nutty', 'silky', 'buttery', 'crunchy', 'punchy',
  // method / equipment
  'slow', 'cooked', 'cooker', 'one', 'pot', 'pan', 'tray', 'traybake', 'bake', 'baked', 'grilled',
  'roast', 'roasted', 'fried', 'panfried', 'stir', 'airfryer', 'air', 'fryer', 'loaded', 'oven',
  // size / quantity
  'extra', 'double', 'triple', 'jumbo', 'king', 'mini', 'giant', 'big', 'little', 'large', 'small',
  // framing
  'style', 'styled', 'inspired', 'recipe', 'dish', 'meal', 'dinner', 'lunch', 'supper',
  'healthy', 'low', 'fat', 'calorie', 'skinny', 'veggie',
]);

function signature(title) {
  const toks = String(title || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)) // light singularise
    .filter((w) => w && !QUALIFIERS.has(w));
  return [...new Set(toks)];
}

// Generic category / protein words that must NOT match on their own (else
// "curry" would swallow every curry). Distinctive dish names (moussaka,
// carbonara, lasagne, risotto, paella…) are deliberately NOT here, so a lone
// "Moussaka" is still caught as a dupe of an existing moussaka recipe.
const GENERIC = new Set([
  'curry', 'pie', 'soup', 'stew', 'salad', 'slaw', 'pasta', 'rice', 'noodle', 'bake', 'casserole',
  'wrap', 'burger', 'chilli', 'chili', 'taco', 'roast', 'sandwich', 'hotpot', 'pizza', 'bowl', 'traybake',
  'chicken', 'beef', 'pork', 'lamb', 'fish', 'prawn', 'salmon', 'cod', 'tofu', 'egg', 'sausage',
  'gammon', 'duck', 'turkey', 'ham', 'bacon', 'veg', 'vegetable', 'cheese',
]);

const subset = (a, b) => a.every((t) => b.includes(t)); // is a ⊆ b
function sameDish(a, b) {
  if (!a.length || !b.length) return false;
  const key = (x) => x.slice().sort().join(' ');
  if (key(a) === key(b)) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = shorter === a ? b : a;
  if (!subset(shorter, longer)) return false;
  if (shorter.length >= 2) return true;
  return !GENERIC.has(shorter[0]); // lone token: only if it's a distinctive dish name
}

// Growing set of dish signatures; seed with existing + blocklisted titles, then
// add each accepted import so within-batch near-dupes are caught too.
class DishSet {
  constructor(titles = []) { this.sigs = []; for (const t of titles) this.add(t); }
  add(title) { const s = signature(title); if (s.length) this.sigs.push(s); }
  has(title) { const s = signature(title); return this.sigs.some((x) => sameDish(s, x)); }
}

module.exports = { signature, sameDish, DishSet };

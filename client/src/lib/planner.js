// Auto-allocation of shortlisted recipes across plan slots, with variety rules.
//
// Rules applied (in priority order when scoring a candidate for a slot):
//   1. Meal-type fit — a recipe must suit the slot's meal (breakfast/lunch/dinner).
//   2. No same cuisine on consecutive days (soft penalty).
//   3. Don't put a "heavy" dinner-style dish at breakfast (hard filter).
//   4. Spread cuisines across the week (favour cuisines used least so far).
//   5. Avoid repeating the exact same recipe until the pool is exhausted.

const HEAVY_TAGS = ['curry', 'roast', 'stew', 'casserole', 'lasagne', 'lasagna', 'pie', 'steak']

function isHeavy(recipe) {
  const t = [...(recipe.tags || []), recipe.category || ''].join(' ').toLowerCase()
  return HEAVY_TAGS.some((h) => t.includes(h)) || (recipe.cook_minutes || 0) >= 60
}

function suitsMeal(recipe, meal) {
  if (!recipe.meal_types?.includes(meal)) return false
  if (meal === 'breakfast' && isHeavy(recipe)) return false
  return true
}

/**
 * @param {Array} slots   plan_slots (each: {id, slot_date, meal})
 * @param {Array} pool    shortlisted recipes
 * @returns {Array}       [{ slotId, recipeId }]
 */
export function autoAllocate(slots, pool) {
  const byDate = {}
  for (const s of slots) (byDate[s.slot_date] ||= []).push(s)
  const dates = Object.keys(byDate).sort()

  const cuisineCount = {}
  const usedRecipeIds = new Set()
  let lastDayCuisines = new Set()
  const assignments = []

  const mealOrder = { breakfast: 0, lunch: 1, dinner: 2 }

  for (const date of dates) {
    const daySlots = byDate[date].sort((a, b) => mealOrder[a.meal] - mealOrder[b.meal])
    const todayCuisines = new Set()

    for (const slot of daySlots) {
      const candidates = pool.filter((r) => suitsMeal(r, slot.meal))
      if (!candidates.length) continue

      const scored = candidates.map((r) => {
        let score = 0
        const cuisine = (r.cuisine || 'other').toLowerCase()
        if (usedRecipeIds.has(r.id)) score -= 40 // strongly avoid repeats
        if (lastDayCuisines.has(cuisine)) score -= 12 // no same cuisine back-to-back
        if (todayCuisines.has(cuisine)) score -= 6 // vary within a day too
        score -= (cuisineCount[cuisine] || 0) * 3 // favour under-used cuisines
        score += Math.random() * 2 // tiny jitter to avoid deterministic ties
        return { r, score, cuisine }
      })
      scored.sort((a, b) => b.score - a.score)
      const pick = scored[0]

      assignments.push({ slotId: slot.id, recipeId: pick.r.id })
      usedRecipeIds.add(pick.r.id)
      todayCuisines.add(pick.cuisine)
      cuisineCount[pick.cuisine] = (cuisineCount[pick.cuisine] || 0) + 1
    }
    lastDayCuisines = todayCuisines
  }
  return assignments
}

// How many recipes a plan needs (one per slot, but repeats allowed so we aim
// for ~70% unique to keep variety without demanding an unrealistic library).
export function targetShortlistSize(slots) {
  const total = slots.length
  return Math.max(3, Math.ceil(total * 0.7))
}

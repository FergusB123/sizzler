import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { Chip, Button, Sheet } from '../components/ui/primitives'

const cuisineIs = (r, re) => re.test(r.cuisine || '')
const hay = (r) =>
  `${r.title} ${r.cuisine || ''} ${r.category || ''} ${(r.tags || []).join(' ')} ${(r.ingredients || []).map((i) => i.name).join(' ')}`.toLowerCase()

// Grouped, multi-select filters shared by the Recipes library and the meal
// planner. Within a group the options are OR'd; across groups they're AND'd.
export const GROUPS = [
  {
    key: 'country', label: 'Country', options: [
      { v: 'british', label: 'British', emoji: '🥧', test: (r) => cuisineIs(r, /british|welsh|english|scottish/i) },
      { v: 'italian', label: 'Italian', emoji: '🍝', test: (r) => cuisineIs(r, /italian/i) },
      { v: 'indian', label: 'Indian', emoji: '🍛', test: (r) => cuisineIs(r, /indian|south asian/i) },
      { v: 'mexican', label: 'Mexican', emoji: '🌯', test: (r) => cuisineIs(r, /mexican/i) },
      { v: 'spanish', label: 'Spanish', emoji: '🦐', test: (r) => cuisineIs(r, /spanish/i) },
      { v: 'chinese', label: 'Chinese', emoji: '🥟', test: (r) => cuisineIs(r, /chinese/i) },
      { v: 'thai', label: 'Thai', emoji: '🍜', test: (r) => cuisineIs(r, /thai/i) },
      { v: 'japanese', label: 'Japanese', emoji: '🍣', test: (r) => cuisineIs(r, /japanese/i) },
      { v: 'korean', label: 'Korean', emoji: '🍲', test: (r) => cuisineIs(r, /korean/i) },
      { v: 'french', label: 'French', emoji: '🥖', test: (r) => cuisineIs(r, /french/i) },
      { v: 'american', label: 'American', emoji: '🍔', test: (r) => cuisineIs(r, /american/i) },
      { v: 'medi', label: 'Mediterranean', emoji: '🫒', test: (r) => cuisineIs(r, /mediterranean|greek|turkish/i) },
      { v: 'mideast', label: 'Middle Eastern', emoji: '🧆', test: (r) => cuisineIs(r, /middle eastern|moroccan|israeli|lebanese/i) },
      { v: 'vietnamese', label: 'Vietnamese', emoji: '🇻🇳', test: (r) => cuisineIs(r, /vietnamese|cambodian/i) },
    ],
  },
  {
    key: 'meal', label: 'Meal type', options: [
      { v: 'breakfast', label: 'Breakfast', emoji: '🍳', test: (r) => r.meal_types?.includes('breakfast') },
      { v: 'lunch', label: 'Lunch', emoji: '🥗', test: (r) => r.meal_types?.includes('lunch') },
      { v: 'dinner', label: 'Dinner', emoji: '🍽️', test: (r) => r.meal_types?.includes('dinner') },
    ],
  },
  {
    key: 'ingredient', label: 'Lead ingredient', options: [
      { v: 'chicken', label: 'Chicken', emoji: '🐔', test: (r) => /chicken/.test(hay(r)) },
      { v: 'beef', label: 'Beef', emoji: '🥩', test: (r) => /\b(beef|steak|mince|cottage pie|bolognese|brisket)\b/.test(hay(r)) },
      { v: 'pork', label: 'Pork', emoji: '🥓', test: (r) => /\b(pork|bacon|sausage|chorizo|gammon|ham)\b/.test(hay(r)) },
      { v: 'lamb', label: 'Lamb', emoji: '🐑', test: (r) => /\blamb\b/.test(hay(r)) },
      { v: 'fish', label: 'Fish & seafood', emoji: '🐟', test: (r) => /\b(fish|salmon|cod|basa|prawn|hake|tuna|seafood|pollock|haddock|mackerel|trout)\b/.test(hay(r)) },
      { v: 'veggie', label: 'Veggie', emoji: '🥦', test: (r) => /(vegetarian|veggie|meat-?free|plant-?based|vegan|paneer|halloumi|tofu)/.test(hay(r)) },
      { v: 'pastarice', label: 'Pasta & rice', emoji: '🍝', test: (r) => /(pasta|spaghetti|tagliatelle|risotto|gnocchi|lasagne|linguine|penne|noodle|fried rice|biryani)/.test(hay(r)) },
    ],
  },
  {
    key: 'time', label: 'Cooking time', options: [
      { v: 'quick', label: 'Under 20 min', emoji: '⚡', test: (r) => r.cook_minutes > 0 && r.cook_minutes <= 20 },
      { v: 'mid', label: '20–40 min', emoji: '⏱️', test: (r) => r.cook_minutes > 20 && r.cook_minutes <= 40 },
      { v: 'long', label: 'Over 40 min', emoji: '🕰️', test: (r) => r.cook_minutes > 40 },
    ],
  },
  {
    key: 'type', label: 'Recipe type', options: [
      { v: 'saved', label: 'Saved', emoji: '❤️', test: (r) => r.favorite },
      { v: 'shared', label: 'Shared', emoji: '🌍', test: (r) => r.is_shared },
    ],
  },
]

const searchHay = (r) => `${r.title} ${r.cuisine} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase()
export const emptySel = () => Object.fromEntries(GROUPS.map((g) => [g.key, new Set()]))

function passesFilters(r, sel) {
  for (const g of GROUPS) {
    const set = sel[g.key]
    if (set.size && !g.options.some((o) => set.has(o.v) && o.test(r))) return false
  }
  return true
}

// State + derived filtering for a recipe list. `q` is an optional search string.
export function useRecipeFilters(recipes, q = '') {
  const [sel, setSel] = useState(emptySel)
  const [open, setOpen] = useState(false)
  const list = recipes || []

  const toggle = (gkey, v) => setSel((prev) => {
    const set = new Set(prev[gkey])
    set.has(v) ? set.delete(v) : set.add(v)
    return { ...prev, [gkey]: set }
  })
  const clearAll = () => setSel(emptySel())
  const activeCount = GROUPS.reduce((n, g) => n + sel[g.key].size, 0)
  const ql = q.trim().toLowerCase()

  const filtered = useMemo(
    () => list.filter((r) => passesFilters(r, sel) && (!ql || searchHay(r).includes(ql))),
    [list, sel, ql],
  )

  // Faceted availability: per group, how many recipes each option matches given
  // the OTHER groups' selections (+ search). Powers the greyed-out disabling.
  const avail = useMemo(() => {
    const out = {}
    for (const g of GROUPS) {
      const base = list.filter((r) => {
        for (const other of GROUPS) {
          if (other.key === g.key) continue
          const set = sel[other.key]
          if (set.size && !other.options.some((o) => set.has(o.v) && o.test(r))) return false
        }
        return !ql || searchHay(r).includes(ql)
      })
      const counts = {}
      for (const o of g.options) counts[o.v] = base.reduce((n, r) => n + (o.test(r) ? 1 : 0), 0)
      out[g.key] = counts
    }
    return out
  }, [list, sel, ql])

  return { sel, toggle, clearAll, activeCount, filtered, avail, open, setOpen }
}

export function FilterButton({ activeCount, onClick, className = '' }) {
  return (
    <button className={`filter-btn ${activeCount ? 'on' : ''} ${className}`} onClick={onClick} aria-label="Filters">
      <Icon name="filter" size={18} />
      {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
    </button>
  )
}

export function ActiveFilterChips({ sel, toggle, clearAll }) {
  const chips = GROUPS.flatMap((g) => [...sel[g.key]].map((v) => ({ gkey: g.key, ...g.options.find((o) => o.v === v) })))
  if (!chips.length) return null
  return (
    <div className="active-filters">
      {chips.map((c) => (
        <button key={c.gkey + c.v} className="active-chip" onClick={() => toggle(c.gkey, c.v)}>
          {c.emoji ? `${c.emoji} ` : ''}{c.label}<Icon name="x" size={13} />
        </button>
      ))}
      <button className="active-clear" onClick={clearAll}>Clear all</button>
    </div>
  )
}

// The filter sheet. `count`/`countLabel` drive the primary button label.
export function FilterSheet({ open, onClose, sel, toggle, clearAll, activeCount, avail, count, countLabel = 'recipe' }) {
  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      {GROUPS.map((g) => (
        <div key={g.key} className="filter-group">
          <div className="filter-group-label">{g.label}</div>
          <div className="chip-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {g.options.map((o) => {
              const selected = sel[g.key].has(o.v)
              const disabled = !selected && (avail[g.key]?.[o.v] ?? 0) === 0
              return (
                <Chip key={o.v} flame active={selected} disabled={disabled} onClick={() => toggle(g.key, o.v)}>
                  {o.emoji ? <span style={{ marginRight: 5 }}>{o.emoji}</span> : null}{o.label}
                </Chip>
              )
            })}
          </div>
        </div>
      ))}
      <div className="filter-actions">
        <Button variant="soft" onClick={clearAll} disabled={!activeCount}>Clear all</Button>
        <Button onClick={onClose}>Show {count} {countLabel}{count === 1 ? '' : 's'}</Button>
      </div>
    </Sheet>
  )
}

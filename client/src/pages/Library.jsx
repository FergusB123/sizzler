import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRecipes } from '../lib/api'
import RecipeCard from '../components/RecipeCard'
import Icon from '../components/Icon'
import { Button, EmptyState, Chip, Sheet } from '../components/ui/primitives'
import './pages.css'

const cuisineIs = (r, re) => re.test(r.cuisine || '')
const hay = (r) =>
  `${r.title} ${r.cuisine || ''} ${r.category || ''} ${(r.tags || []).join(' ')} ${(r.ingredients || []).map((i) => i.name).join(' ')}`.toLowerCase()

// Grouped, multi-select filters. Within a group the options are OR'd; across
// groups they're AND'd.
const GROUPS = [
  {
    key: 'country', label: 'Country', options: [
      { v: 'british', label: 'British', emoji: '🇬🇧', test: (r) => cuisineIs(r, /british|welsh|english|scottish/i) },
      { v: 'italian', label: 'Italian', emoji: '🇮🇹', test: (r) => cuisineIs(r, /italian/i) },
      { v: 'indian', label: 'Indian', emoji: '🇮🇳', test: (r) => cuisineIs(r, /indian|south asian/i) },
      { v: 'mexican', label: 'Mexican', emoji: '🇲🇽', test: (r) => cuisineIs(r, /mexican/i) },
      { v: 'spanish', label: 'Spanish', emoji: '🇪🇸', test: (r) => cuisineIs(r, /spanish/i) },
      { v: 'chinese', label: 'Chinese', emoji: '🇨🇳', test: (r) => cuisineIs(r, /chinese/i) },
      { v: 'thai', label: 'Thai', emoji: '🇹🇭', test: (r) => cuisineIs(r, /thai/i) },
      { v: 'japanese', label: 'Japanese', emoji: '🇯🇵', test: (r) => cuisineIs(r, /japanese/i) },
      { v: 'korean', label: 'Korean', emoji: '🇰🇷', test: (r) => cuisineIs(r, /korean/i) },
      { v: 'french', label: 'French', emoji: '🇫🇷', test: (r) => cuisineIs(r, /french/i) },
      { v: 'american', label: 'American', emoji: '🇺🇸', test: (r) => cuisineIs(r, /american/i) },
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
    key: 'difficulty', label: 'Difficulty', options: [
      { v: 'easy', label: 'Easy', test: (r) => r.difficulty === 'easy' },
      { v: 'medium', label: 'Medium', test: (r) => r.difficulty === 'medium' },
      { v: 'hard', label: 'Hard', test: (r) => r.difficulty === 'hard' },
    ],
  },
  {
    key: 'type', label: 'Recipe type', options: [
      { v: 'saved', label: 'Saved', emoji: '❤️', test: (r) => r.favorite },
      { v: 'shared', label: 'Shared', emoji: '🌍', test: (r) => r.is_shared },
    ],
  },
]

const emptySel = () => Object.fromEntries(GROUPS.map((g) => [g.key, new Set()]))

export default function Library() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(emptySel)
  const [sheet, setSheet] = useState(false)

  useEffect(() => { listRecipes().then(setRecipes) }, [])

  const toggle = (gkey, v) => setSel((prev) => {
    const set = new Set(prev[gkey])
    set.has(v) ? set.delete(v) : set.add(v)
    return { ...prev, [gkey]: set }
  })
  const clearAll = () => setSel(emptySel())
  const activeCount = GROUPS.reduce((n, g) => n + sel[g.key].size, 0)

  const filtered = useMemo(() => {
    if (!recipes) return []
    return recipes.filter((r) => {
      for (const g of GROUPS) {
        const set = sel[g.key]
        if (set.size && !g.options.some((o) => set.has(o.v) && o.test(r))) return false
      }
      if (q) {
        const h = `${r.title} ${r.cuisine} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase()
        if (!h.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [recipes, q, sel])

  // Flat list of active filters for the removable summary chips.
  const activeChips = GROUPS.flatMap((g) =>
    [...sel[g.key]].map((v) => ({ gkey: g.key, ...g.options.find((o) => o.v === v) })))

  return (
    <div className="screen">
      <div className="topbar" style={{ padding: 0, marginBottom: 14, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="overline">{recipes?.length ?? 0} recipe{recipes?.length === 1 ? '' : 's'}</div>
          <h1 style={{ marginTop: 4 }}>Your recipes</h1>
        </div>
        <Button variant="dark" sm onClick={() => navigate('/add')}><Icon name="plus" size={16} /> Add</Button>
      </div>

      <div className="lib-controls">
        <div className="lib-search">
          <Icon name="search" size={18} className="lib-search-ic" />
          <input className="input" placeholder="Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className={`filter-btn ${activeCount ? 'on' : ''}`} onClick={() => setSheet(true)} aria-label="Filters">
          <Icon name="filter" size={18} />
          {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
        </button>
      </div>

      {activeChips.length > 0 && (
        <div className="active-filters">
          {activeChips.map((c) => (
            <button key={c.gkey + c.v} className="active-chip" onClick={() => toggle(c.gkey, c.v)}>
              {c.emoji ? `${c.emoji} ` : ''}{c.label}<Icon name="x" size={13} />
            </button>
          ))}
          <button className="active-clear" onClick={clearAll}>Clear all</button>
        </div>
      )}

      <button className="discover-banner" onClick={() => navigate('/community')}>
        <span className="db-ic"><Icon name="globe" size={18} /></span>
        <span className="db-txt"><b>Discover community recipes</b><span>Browse and save dishes shared by other cooks</span></span>
        <Icon name="arrowRight" size={18} />
      </button>

      {recipes === null ? (
        <div className="recipe-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 210 }} />)}</div>
      ) : recipes.length === 0 ? (
        <EmptyState icon="book" title="Your cookbook is empty"
          action={<Button lg onClick={() => navigate('/add')}>Add your first recipe</Button>}>
          Everything you save lives here — add by hand, paste a link, snap a photo, or drop a social video.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="No matches" action={<Button variant="soft" onClick={clearAll}>Clear filters</Button>}>
          Try fewer filters or a different search.
        </EmptyState>
      ) : (
        <div className="recipe-grid">
          {filtered.map((r) => <RecipeCard key={r.id} recipe={r} to={`/recipes/${r.id}`} origin="you" />)}
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters">
        {GROUPS.map((g) => (
          <div key={g.key} className="filter-group">
            <div className="filter-group-label">{g.label}</div>
            <div className="chip-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {g.options.map((o) => (
                <Chip key={o.v} flame active={sel[g.key].has(o.v)} onClick={() => toggle(g.key, o.v)}>
                  {o.emoji ? <span style={{ marginRight: 5 }}>{o.emoji}</span> : null}{o.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        <div className="filter-actions">
          <Button variant="soft" onClick={clearAll} disabled={!activeCount}>Clear all</Button>
          <Button onClick={() => setSheet(false)}>Show {filtered.length} recipe{filtered.length === 1 ? '' : 's'}</Button>
        </div>
      </Sheet>
    </div>
  )
}

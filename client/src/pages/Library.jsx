import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRecipes } from '../lib/api'
import RecipeCard from '../components/RecipeCard'
import Icon from '../components/Icon'
import { Button, EmptyState, Chip } from '../components/ui/primitives'
import { MEAL_OPTIONS } from '../lib/constants'
import './pages.css'

// Graphical quick-filters: cuisines + key ingredients/attributes.
const FACETS = [
  { key: 'chicken', emoji: '🐔', label: 'Chicken' },
  { key: 'beef', emoji: '🥩', label: 'Beef' },
  { key: 'fish', emoji: '🐟', label: 'Fish' },
  { key: 'veggie', emoji: '🥦', label: 'Veggie' },
  { key: 'spicy', emoji: '🌶️', label: 'Spicy' },
  { key: 'pasta', emoji: '🍝', label: 'Pasta' },
  { key: 'british', emoji: '🇬🇧', label: 'British' },
  { key: 'italian', emoji: '🇮🇹', label: 'Italian' },
  { key: 'indian', emoji: '🇮🇳', label: 'Indian' },
  { key: 'mexican', emoji: '🇲🇽', label: 'Mexican' },
  { key: 'spanish', emoji: '🇪🇸', label: 'Spanish' },
  { key: 'asian', emoji: '🥢', label: 'Asian' },
]
const cuisineIs = (r, re) => re.test(r.cuisine || '')
const FACET_TEST = {
  chicken: (r, hay) => /chicken/.test(hay),
  beef: (r, hay) => /\b(beef|steak|mince|cottage pie|bolognese|brisket)\b/.test(hay),
  fish: (r, hay) => /\b(fish|salmon|cod|basa|prawn|hake|tuna|seafood|pollock|haddock|mackerel|trout)\b/.test(hay),
  veggie: (r, hay) => /(vegetarian|veggie|meat-?free|plant-?based|vegan|paneer|halloumi|tofu)/.test(hay),
  spicy: (r, hay) => /(spicy|chilli|chili|curry|jalfrezi|tikka|sriracha|fiery|harissa|katsu|rogan|madras|vindaloo|nduja)/.test(hay),
  pasta: (r, hay) => /(pasta|spaghetti|tagliatelle|risotto|gnocchi|lasagne|lasagna|linguine|penne|carbonara|orzo|ravioli|cacio)/.test(hay),
  british: (r) => cuisineIs(r, /british|welsh|english|scottish/i),
  italian: (r) => cuisineIs(r, /italian/i),
  indian: (r) => cuisineIs(r, /indian|south asian/i),
  mexican: (r) => cuisineIs(r, /mexican/i),
  spanish: (r) => cuisineIs(r, /spanish/i),
  asian: (r) => cuisineIs(r, /asian|chinese|thai|japanese|korean|vietnamese|malaysian|indonesian|cambodian/i),
}
const facetHay = (r) =>
  `${r.title} ${r.cuisine || ''} ${r.category || ''} ${(r.tags || []).join(' ')} ${(r.ingredients || []).map((i) => i.name).join(' ')}`.toLowerCase()

export default function Library() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all') // all | saved | shared | <meal>
  const [facet, setFacet] = useState(null) // graphical cuisine/ingredient filter

  useEffect(() => { listRecipes().then(setRecipes) }, [])

  const filtered = useMemo(() => {
    if (!recipes) return []
    return recipes.filter((r) => {
      if (filter === 'saved' && !r.favorite) return false
      else if (filter === 'shared' && !r.is_shared) return false
      else if (['breakfast', 'lunch', 'dinner'].includes(filter) && !r.meal_types.includes(filter)) return false
      if (facet && !FACET_TEST[facet](r, facetHay(r))) return false
      if (q) {
        const hay = `${r.title} ${r.cuisine} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [recipes, q, filter, facet])

  return (
    <div className="screen">
      <div className="topbar" style={{ padding: 0, marginBottom: 14, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="overline">{recipes?.length ?? 0} recipe{recipes?.length === 1 ? '' : 's'}</div>
          <h1 style={{ marginTop: 4 }}>Your recipes</h1>
        </div>
        <Button variant="dark" sm onClick={() => navigate('/add')}><Icon name="plus" size={16} /> Add</Button>
      </div>

      <div className="facet-row">
        {FACETS.map((f) => (
          <button key={f.key} className={`facet ${facet === f.key ? 'active' : ''}`} onClick={() => setFacet(facet === f.key ? null : f.key)}>
            <span className="facet-emoji">{f.emoji}</span>{f.label}
          </button>
        ))}
      </div>

      <input className="input" placeholder="Search recipes, cuisines, tags…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="chip-row chip-scroll" style={{ marginBottom: 18 }}>
        <Chip flame active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        <Chip flame active={filter === 'saved'} onClick={() => setFilter('saved')}>Saved</Chip>
        <Chip flame active={filter === 'shared'} onClick={() => setFilter('shared')}>Shared</Chip>
        {MEAL_OPTIONS.map((m) => <Chip key={m.value} flame active={filter === m.value} onClick={() => setFilter(m.value)}>{m.label}</Chip>)}
      </div>

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
        <EmptyState icon={filter === 'saved' ? 'heart' : 'search'} title={filter === 'saved' ? 'No favourites yet' : 'No matches'}>
          {filter === 'saved' ? 'Tap the heart on a recipe to save it here.' : 'Try a different search or filter.'}
        </EmptyState>
      ) : (
        <div className="recipe-grid">
          {filtered.map((r) => <RecipeCard key={r.id} recipe={r} to={`/recipes/${r.id}`} origin="you" />)}
        </div>
      )}
    </div>
  )
}

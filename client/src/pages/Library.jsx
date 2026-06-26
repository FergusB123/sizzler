import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRecipes } from '../lib/api'
import RecipeCard from '../components/RecipeCard'
import Icon from '../components/Icon'
import { Button, EmptyState, Chip } from '../components/ui/primitives'
import { MEAL_OPTIONS } from '../lib/constants'
import './pages.css'

export default function Library() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all') // all | saved | shared | <meal>

  useEffect(() => { listRecipes().then(setRecipes) }, [])

  const filtered = useMemo(() => {
    if (!recipes) return []
    return recipes.filter((r) => {
      if (filter === 'saved' && !r.favorite) return false
      else if (filter === 'shared' && !r.is_shared) return false
      else if (['breakfast', 'lunch', 'dinner'].includes(filter) && !r.meal_types.includes(filter)) return false
      if (q) {
        const hay = `${r.title} ${r.cuisine} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [recipes, q, filter])

  return (
    <div className="screen">
      <div className="topbar" style={{ padding: 0, marginBottom: 14, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="overline">{recipes?.length ?? 0} recipe{recipes?.length === 1 ? '' : 's'}</div>
          <h1 style={{ marginTop: 4 }}>Your recipes</h1>
        </div>
        <Button variant="dark" sm onClick={() => navigate('/add')}><Icon name="plus" size={16} /> Add</Button>
      </div>

      <input className="input" placeholder="Search recipes, cuisines, tags…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="chip-row chip-scroll" style={{ marginBottom: 18 }}>
        <Chip flame active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        <Chip flame active={filter === 'saved'} onClick={() => setFilter('saved')}>Saved</Chip>
        <Chip flame active={filter === 'shared'} onClick={() => setFilter('shared')}>Shared</Chip>
        {MEAL_OPTIONS.map((m) => <Chip key={m.value} flame active={filter === m.value} onClick={() => setFilter(m.value)}>{m.label}</Chip>)}
      </div>

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

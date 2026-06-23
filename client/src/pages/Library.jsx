import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRecipes } from '../lib/api'
import RecipeCard from '../components/RecipeCard'
import { Button, EmptyState, Chip } from '../components/ui/primitives'
import { MEAL_OPTIONS } from '../lib/constants'
import './pages.css'

export default function Library() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [q, setQ] = useState('')
  const [meal, setMeal] = useState(null)

  useEffect(() => { listRecipes().then(setRecipes) }, [])

  const filtered = useMemo(() => {
    if (!recipes) return []
    return recipes.filter((r) => {
      if (meal && !r.meal_types.includes(meal)) return false
      if (q) {
        const hay = `${r.title} ${r.cuisine} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [recipes, q, meal])

  return (
    <div className="screen">
      <div className="topbar" style={{ padding: 0, marginBottom: 14 }}>
        <h1>Recipes</h1>
        <Button onClick={() => navigate('/add')}>+ Add</Button>
      </div>

      <input className="input" placeholder="Search recipes, cuisines, tags…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="chip-row" style={{ marginBottom: 18 }}>
        <Chip flame active={!meal} onClick={() => setMeal(null)}>All</Chip>
        {MEAL_OPTIONS.map((m) => <Chip key={m.value} flame active={meal === m.value} onClick={() => setMeal(m.value)}>{m.label}</Chip>)}
      </div>

      {recipes === null ? (
        <div className="recipe-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 210 }} />)}</div>
      ) : recipes.length === 0 ? (
        <EmptyState icon="book" title="Your cookbook is empty"
          action={<Button lg onClick={() => navigate('/add')}>Add your first recipe</Button>}>
          Everything you save lives here — add by hand, paste a link, snap a photo, or drop a social video.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="No matches">Try a different search or filter.</EmptyState>
      ) : (
        <div className="recipe-grid">
          {filtered.map((r) => <RecipeCard key={r.id} recipe={r} to={`/recipes/${r.id}`} origin="you" />)}
        </div>
      )}
    </div>
  )
}

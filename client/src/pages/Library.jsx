import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRecipes } from '../lib/api'
import RecipeCard from '../components/RecipeCard'
import Icon from '../components/Icon'
import { Button, EmptyState } from '../components/ui/primitives'
import { useRecipeFilters, FilterButton, ActiveFilterChips, FilterSheet } from '../lib/recipeFilters'
import './pages.css'

export default function Library() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [q, setQ] = useState('')
  const f = useRecipeFilters(recipes, q)

  useEffect(() => { listRecipes().then(setRecipes) }, [])

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
        <FilterButton activeCount={f.activeCount} onClick={() => f.setOpen(true)} />
      </div>

      <ActiveFilterChips sel={f.sel} toggle={f.toggle} clearAll={f.clearAll} />

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
      ) : f.filtered.length === 0 ? (
        <EmptyState icon="search" title="No matches" action={<Button variant="soft" onClick={f.clearAll}>Clear filters</Button>}>
          Try fewer filters or a different search.
        </EmptyState>
      ) : (
        <div className="recipe-grid">
          {f.filtered.map((r) => <RecipeCard key={r.id} recipe={r} to={`/recipes/${r.id}`} origin="you" />)}
        </div>
      )}

      <FilterSheet open={f.open} onClose={() => f.setOpen(false)} sel={f.sel} toggle={f.toggle}
        clearAll={f.clearAll} activeCount={f.activeCount} avail={f.avail} count={f.filtered.length} />
    </div>
  )
}

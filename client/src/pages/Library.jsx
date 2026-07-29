import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRecipes, bulkDeleteRecipes } from '../lib/api'
import RecipeCard from '../components/RecipeCard'
import Icon from '../components/Icon'
import { Button, EmptyState, Sheet, useToast } from '../components/ui/primitives'
import { useRecipeFilters, FilterButton, ActiveFilterChips, FilterSheet } from '../lib/recipeFilters'
import './pages.css'

export default function Library() {
  const navigate = useNavigate()
  const toast = useToast()
  const [recipes, setRecipes] = useState(null)
  const [q, setQ] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const f = useRecipeFilters(recipes, q)

  useEffect(() => { listRecipes().then(setRecipes) }, [])

  const toggle = (id) => setSelected((prev) => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()) }

  const visibleIds = (f.filtered || []).map((r) => r.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds))

  async function doDelete() {
    const ids = [...selected]
    setDeleting(true)
    try {
      await bulkDeleteRecipes(ids)
      const gone = new Set(ids)
      setRecipes((rs) => (rs || []).filter((r) => !gone.has(r.id)))
      toast.success(`Deleted ${ids.length} recipe${ids.length === 1 ? '' : 's'}`)
      setConfirm(false)
      exitSelect()
    } catch (e) { toast.error(e.message) } finally { setDeleting(false) }
  }

  return (
    <div className="screen">
      <div className="topbar" style={{ padding: 0, marginBottom: 14, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="overline">{recipes?.length ?? 0} recipe{recipes?.length === 1 ? '' : 's'}</div>
          <h1 style={{ marginTop: 4 }}>Your recipes</h1>
        </div>
        {selectMode ? (
          <Button variant="ghost" sm onClick={exitSelect}>Done</Button>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            {recipes?.length ? (
              <Button variant="ghost" sm onClick={() => setSelectMode(true)}><Icon name="check" size={16} /> Select</Button>
            ) : null}
            <Button variant="dark" sm onClick={() => navigate('/add')}><Icon name="plus" size={16} /> Add</Button>
          </div>
        )}
      </div>

      <div className="lib-controls">
        <div className="lib-search">
          <Icon name="search" size={18} className="lib-search-ic" />
          <input className="input" placeholder="Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FilterButton activeCount={f.activeCount} onClick={() => f.setOpen(true)} />
      </div>

      <ActiveFilterChips sel={f.sel} toggle={f.toggle} clearAll={f.clearAll} />

      {selectMode && (
        <div className="lib-selbar">
          <button type="button" className="lib-selall" onClick={toggleAll}>
            {allSelected ? 'Clear all' : `Select all${visibleIds.length ? ` (${visibleIds.length})` : ''}`}
          </button>
          <span className="lib-selcount">{selected.size} selected</span>
          <Button variant="danger" sm disabled={!selected.size} onClick={() => setConfirm(true)}>
            <Icon name="trash" size={15} /> Delete
          </Button>
        </div>
      )}

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
          {f.filtered.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              origin="you"
              to={selectMode ? undefined : `/recipes/${r.id}`}
              selectable={selectMode}
              selected={selected.has(r.id)}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      <FilterSheet open={f.open} onClose={() => f.setOpen(false)} sel={f.sel} toggle={f.toggle}
        clearAll={f.clearAll} activeCount={f.activeCount} avail={f.avail} count={f.filtered.length} />

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={`Delete ${selected.size} recipe${selected.size === 1 ? '' : 's'}?`}>
        <p className="muted" style={{ marginBottom: 18 }}>
          This permanently removes {selected.size === 1 ? 'this recipe' : 'these recipes'} from your cookbook. This can't be undone.
        </p>
        <div className="row" style={{ gap: 12 }}>
          <Button variant="soft" block onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" block loading={deleting} onClick={doDelete}>Delete {selected.size}</Button>
        </div>
      </Sheet>
    </div>
  )
}

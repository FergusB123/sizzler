import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Reorder, useDragControls } from 'framer-motion'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, createPlan, getPlanSlots, assignSlot, assignSlots, listRecipes, getShoppingList } from '../lib/api'
import { autoAllocate } from '../lib/planner'
import { Button, SizzleLoader, Sheet, IconButton, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import RecipeCard from '../components/RecipeCard'
import { useGoBack } from '../lib/useGoBack'
import { useRecipeFilters, FilterButton, ActiveFilterChips, FilterSheet } from '../lib/recipeFilters'
import './manual-planner.css'

const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
const dow = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
const dnum = (d) => new Date(d + 'T00:00:00').getDate()

// One draggable night: a dark day badge, the recipe slot, and a grip handle.
// The grip starts the drag. Tapping a filled slot opens the recipe; the swap
// button changes it. An empty slot taps straight into the picker to add one.
function NightItem({ item, date, index, onOpenRecipe, onChange, onDragEnd }) {
  const controls = useDragControls()
  const recipe = item.recipe
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} onDragEnd={onDragEnd}
      className={`mp-night ${recipe ? 'filled' : ''}`}>
      <div className="mp-daybadge">
        <span className="mp-dow">{dow(date)}</span>
        <span className="mp-dnum">{dnum(date)}</span>
      </div>
      {recipe ? (
        <button className="mp-slot filled" onClick={() => onOpenRecipe(recipe)}>
          <span className="mp-recipe">
            {recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span className="mp-recipe-fb">{(recipe.title || '?').charAt(0).toUpperCase()}</span>}
            <b>{recipe.title}</b>
          </span>
        </button>
      ) : (
        <button className="mp-slot empty" onClick={() => onChange(index)}>
          <span className="mp-add"><Icon name="plus" size={17} /> Add a recipe</span>
        </button>
      )}
      {recipe && (
        <button className="mp-swap" aria-label="Change recipe" onClick={() => onChange(index)}><Icon name="swap" size={17} /></button>
      )}
      <span className="mp-drag" aria-label="Drag to reorder" onPointerDown={(e) => controls.start(e)}><Icon name="grip" size={18} /></span>
    </Reorder.Item>
  )
}

export default function ManualPlanner() {
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const toast = useToast()
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState([])
  const [recipes, setRecipes] = useState([])
  const [order, setOrder] = useState([]) // [{ key, recipe }] in night order
  const [picker, setPicker] = useState(null) // { index }
  const [q, setQ] = useState('')
  const [listBuilt, setListBuilt] = useState(false)
  const keyRef = useRef(0)
  const orderRef = useRef(order)
  orderRef.current = order

  const f = useRecipeFilters(recipes)

  useEffect(() => {
    (async () => {
      let p = await getActivePlan()
      if (!p) p = await createPlan({ startDate: new Date(), days: profile?.planning_horizon_days || 7, meals: profile?.planned_meals || ['dinner'] })
      const s = (await getPlanSlots(p.id)).sort((a, b) => a.slot_date.localeCompare(b.slot_date))
      setSlots(s)
      setOrder(s.map((x) => ({ key: `n${keyRef.current++}`, recipe: x.recipe })))
      setRecipes(await listRecipes())
      try { const items = await getShoppingList(p.id); setListBuilt((items?.length || 0) > 0) } catch { /* no list yet */ }
      setLoading(false)
    })()
  }, [])

  // Fixed night structure: dates in order + the slot id assigned to each.
  const dates = useMemo(() => slots.map((s) => s.slot_date), [slots])
  const slotIdByDate = useMemo(() => Object.fromEntries(slots.map((s) => [s.slot_date, s.id])), [slots])

  const saveArrangement = (ord) => {
    const assignments = dates.map((d, i) => ({ slotId: slotIdByDate[d], recipeId: ord[i]?.recipe?.id ?? null }))
    assignSlots(assignments).catch((e) => toast.error(e.message))
  }

  function openPicker(index) { setPicker({ index }); setQ('') }

  async function pick(recipeId) {
    const i = picker.index
    setPicker(null); setQ('')
    const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : null
    setOrder((ord) => ord.map((o, idx) => idx === i ? { ...o, recipe } : o))
    try { await assignSlot(slotIdByDate[dates[i]], recipeId) } catch (e) { toast.error(e.message) }
  }

  // Re-allocate the current dishes across the nights with fresh variety.
  function reshuffle() {
    const pool = order.map((o) => o.recipe).filter(Boolean)
    if (pool.length < 2) return
    const assignments = autoAllocate(slots, pool) // [{ slotId, recipeId }]
    const bySlot = Object.fromEntries(assignments.map((a) => [a.slotId, a.recipeId]))
    // Reuse existing entries (keys travel with dishes) so the shuffle animates.
    const avail = new Map()
    order.forEach((o) => { if (o.recipe) { const k = o.recipe.id; if (!avail.has(k)) avail.set(k, []); avail.get(k).push(o) } })
    const newOrder = dates.map((d) => {
      const rid = bySlot[slotIdByDate[d]] ?? null
      if (rid == null) return { key: `n${keyRef.current++}`, recipe: null }
      const reuse = avail.get(rid)
      if (reuse && reuse.length) return reuse.shift()
      return { key: `n${keyRef.current++}`, recipe: recipes.find((r) => r.id === rid) || null }
    })
    setOrder(newOrder)
    assignSlots(assignments).catch((e) => toast.error(e.message))
  }

  const pickList = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return f.filtered.filter((r) => !ql || `${r.title} ${r.cuisine} ${(r.tags || []).join(' ')}`.toLowerCase().includes(ql))
  }, [f.filtered, q])

  if (loading) return <div className="screen no-nav"><SizzleLoader message="Loading planner…" /></div>

  const filledCount = order.filter((o) => o.recipe).length

  return (
    <div className="screen no-nav mp-screen">
      <div className="mp-hero">
        <div className="mp-hero-top">
          <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
        </div>
        <h1 className="mp-hero-title">Your plan</h1>
        <div className="mp-hero-meta">
          <span>{order.length} night{order.length === 1 ? '' : 's'} · drag to reorder</span>
          {filledCount >= 2 && (
            <button className="mp-reshuffle" onClick={reshuffle}><Icon name="shuffle" size={15} /> Reshuffle</button>
          )}
        </div>
      </div>

      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="mp-nights">
        {order.map((item, i) => (
          <NightItem key={item.key} item={item} date={dates[i]} index={i}
            onOpenRecipe={(r) => navigate(`/recipes/${r.id}`)} onChange={openPicker}
            onDragEnd={() => saveArrangement(orderRef.current)} />
        ))}
      </Reorder.Group>

      {!listBuilt && (
        <Button block lg className="mp-done" onClick={() => navigate('/shopping')}>Done — build shopping list</Button>
      )}

      <Sheet open={picker !== null} onClose={() => { setPicker(null); setQ('') }} title={picker !== null ? dayLabel(dates[picker.index]) : ''}>
        <div className="lib-controls">
          <div className="lib-search">
            <span className="lib-search-ic"><Icon name="search" size={17} /></span>
            <input className="input" placeholder="Search your recipes…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <FilterButton activeCount={f.activeCount} onClick={() => f.setOpen(true)} />
        </div>
        <ActiveFilterChips sel={f.sel} toggle={f.toggle} clearAll={f.clearAll} />
        {picker !== null && order[picker.index]?.recipe && <Button variant="soft" block onClick={() => pick(null)} style={{ marginBottom: 12 }}>Clear this night</Button>}
        <div className="recipe-grid swap-grid">
          {pickList.map((r) => (
            <button key={r.id} className="swap-tile" onClick={() => pick(r.id)}>
              <RecipeCard recipe={r} origin="you" />
              <span className="swap-add"><Icon name="plus" size={15} /> Add to plan</span>
            </button>
          ))}
        </div>
        {pickList.length === 0 && <p className="muted">No recipes match. Adjust your filters or search.</p>}
      </Sheet>

      <FilterSheet open={f.open} onClose={() => f.setOpen(false)} sel={f.sel} toggle={f.toggle}
        clearAll={f.clearAll} activeCount={f.activeCount} avail={f.avail} count={f.filtered.length} />
    </div>
  )
}

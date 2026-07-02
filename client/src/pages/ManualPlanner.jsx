import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Reorder, useDragControls } from 'framer-motion'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, createPlan, getPlanSlots, assignSlot, assignSlots, listRecipes } from '../lib/api'
import { autoAllocate } from '../lib/planner'
import { Button, SizzleLoader, Sheet, IconButton, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { formatTime } from '../components/RecipeCard'
import { useGoBack } from '../lib/useGoBack'
import { useRecipeFilters, FilterButton, ActiveFilterChips, FilterSheet } from '../lib/recipeFilters'
import './manual-planner.css'

const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })

// One draggable night. A dedicated grip starts the drag so tapping the card
// still opens the recipe picker and the page can scroll normally.
function NightItem({ item, date, index, onOpen, onDragEnd }) {
  const controls = useDragControls()
  const recipe = item.recipe
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="mp-night">
      <div className="mp-night-head">
        <span className="mp-night-day">{dayLabel(date)}</span>
        <span className="mp-drag" aria-label="Drag to reorder" onPointerDown={(e) => controls.start(e)}><Icon name="grip" size={18} /></span>
      </div>
      <button className={`mp-slot ${recipe ? 'filled' : 'empty'}`} onClick={() => onOpen(index)}>
        {recipe ? (
          <span className="mp-recipe">
            {recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span className="mp-recipe-fb">{(recipe.title || '?').charAt(0).toUpperCase()}</span>}
            <b>{recipe.title}</b>
          </span>
        ) : (
          <span className="mp-add"><Icon name="plus" size={17} /> Add a recipe</span>
        )}
      </button>
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
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 10 }}>
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24 }}>Your plan</h1>
        </div>
        <FilterButton activeCount={f.activeCount} onClick={() => f.setOpen(true)} />
      </div>

      <div className="mp-toolbar">
        <span className="mp-sub">Drag to reorder · tap to change</span>
        {filledCount >= 2 && (
          <button className="mp-reshuffle" onClick={reshuffle}><Icon name="shuffle" size={15} /> Reshuffle</button>
        )}
      </div>

      <ActiveFilterChips sel={f.sel} toggle={f.toggle} clearAll={f.clearAll} />

      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="mp-nights">
        {order.map((item, i) => (
          <NightItem key={item.key} item={item} date={dates[i]} index={i}
            onOpen={openPicker} onDragEnd={() => saveArrangement(orderRef.current)} />
        ))}
      </Reorder.Group>

      <Button block lg className="mp-done" onClick={() => navigate('/shopping')}>Done — build shopping list</Button>

      <Sheet open={picker !== null} onClose={() => { setPicker(null); setQ('') }} title={picker !== null ? dayLabel(dates[picker.index]) : ''}>
        <input className="input" placeholder="Search your recipes…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14 }} />
        {picker !== null && order[picker.index]?.recipe && <Button variant="soft" block onClick={() => pick(null)} style={{ marginBottom: 12 }}>Clear this night</Button>}
        <div className="plan-picker">
          {pickList.map((r) => (
            <button key={r.id} className="plan-picker-item" onClick={() => pick(r.id)}>
              <div className="ppi-img">{r.image_url ? <img src={r.image_url} alt="" /> : <span className="ppi-initial">{(r.title || '?').charAt(0).toUpperCase()}</span>}</div>
              <div className="ppi-body"><b>{r.title}</b><span>{r.cuisine || '—'}{((r.prep_minutes || 0) + (r.cook_minutes || 0)) > 0 ? ` · ${formatTime((r.prep_minutes || 0) + (r.cook_minutes || 0))}` : ''}</span></div>
            </button>
          ))}
          {pickList.length === 0 && <p className="muted">No recipes match. Adjust your filters or search.</p>}
        </div>
      </Sheet>

      <FilterSheet open={f.open} onClose={() => f.setOpen(false)} sel={f.sel} toggle={f.toggle}
        clearAll={f.clearAll} activeCount={f.activeCount} avail={f.avail} count={f.filtered.length} />
    </div>
  )
}

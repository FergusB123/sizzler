import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, createPlan, getPlanSlots, assignSlot, listRecipes } from '../lib/api'
import { Button, SizzleLoader, Sheet, IconButton, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { formatTime } from '../components/RecipeCard'
import { useGoBack } from '../lib/useGoBack'
import { useRecipeFilters, FilterButton, ActiveFilterChips, FilterSheet } from '../lib/recipeFilters'
import './manual-planner.css'

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }
const mealOrder = { breakfast: 0, lunch: 1, dinner: 2 }
const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })

export default function ManualPlanner() {
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const toast = useToast()
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState([])
  const [recipes, setRecipes] = useState([])
  const [picker, setPicker] = useState(null)
  const [q, setQ] = useState('')

  // Same grouped filters as the library, applied to the recipes offered in the picker.
  const f = useRecipeFilters(recipes)

  useEffect(() => {
    (async () => {
      let p = await getActivePlan()
      if (!p) p = await createPlan({ startDate: new Date(), days: profile?.planning_horizon_days || 7, meals: profile?.planned_meals || ['breakfast', 'lunch', 'dinner'] })
      setSlots(await getPlanSlots(p.id))
      setRecipes(await listRecipes())
      setLoading(false)
    })()
  }, [])

  async function pick(recipeId) {
    const slot = picker
    setPicker(null); setQ('')
    setSlots((s) => s.map((x) => x.id === slot.id ? { ...x, recipe_id: recipeId, recipe: recipes.find((r) => r.id === recipeId) } : x))
    try { await assignSlot(slot.id, recipeId) } catch (e) { toast.error(e.message) }
  }

  // Picker list = globally-filtered recipes, narrowed to the slot's meal + search.
  const pickList = useMemo(() => {
    return f.filtered.filter((r) => {
      if (picker && !r.meal_types.includes(picker.meal)) return false
      if (q && !`${r.title} ${r.cuisine} ${(r.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [f.filtered, picker, q])

  if (loading) return <div className="screen no-nav"><SizzleLoader message="Loading planner…" /></div>

  const byDate = {}
  slots.forEach((s) => (byDate[s.slot_date] ||= []).push(s))
  const dates = Object.keys(byDate).sort()

  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 10 }}>
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24 }}>Build your plan</h1>
          <div className="mp-sub">Tap a slot to add a recipe</div>
        </div>
        <FilterButton activeCount={f.activeCount} onClick={() => f.setOpen(true)} />
      </div>

      <ActiveFilterChips sel={f.sel} toggle={f.toggle} clearAll={f.clearAll} />

      {dates.map((date) => (
        <div key={date} className="mp-day">
          <h3 className="mp-day-h">{dayLabel(date)}</h3>
          {byDate[date].sort((a, b) => mealOrder[a.meal] - mealOrder[b.meal]).map((slot) => (
            <div key={slot.id} className="mp-meal-block">
              <div className="mp-meal-label">{MEAL_LABEL[slot.meal]}</div>
              <button className={`mp-slot ${slot.recipe_id ? 'filled' : 'empty'}`} onClick={() => setPicker(slot)}>
                {slot.recipe ? (
                  <span className="mp-recipe">
                    {slot.recipe.image_url ? <img src={slot.recipe.image_url} alt="" /> : <span className="mp-recipe-fb">{(slot.recipe.title || '?').charAt(0).toUpperCase()}</span>}
                    <b>{slot.recipe.title}</b>
                  </span>
                ) : (
                  <span className="mp-add"><Icon name="plus" size={17} /> Add a recipe</span>
                )}
              </button>
            </div>
          ))}
        </div>
      ))}

      <Button block lg className="mp-done" onClick={() => navigate('/shopping')}>Done — build shopping list</Button>

      <Sheet open={!!picker} onClose={() => { setPicker(null); setQ('') }} title={picker ? `${MEAL_LABEL[picker.meal]} · ${dayLabel(picker.slot_date)}` : ''}>
        <input className="input" placeholder="Search your recipes…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14 }} />
        {picker?.recipe_id && <Button variant="soft" block onClick={() => pick(null)} style={{ marginBottom: 12 }}>Clear this slot</Button>}
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

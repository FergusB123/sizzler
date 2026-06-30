import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, createPlan, getPlanSlots, assignSlot, listRecipes } from '../lib/api'
import { Button, SizzleLoader, Sheet, Chip, IconButton, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { formatTime } from '../components/RecipeCard'
import { useGoBack } from '../lib/useGoBack'
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

  // picker filters
  const [q, setQ] = useState('')
  const [cookFilter, setCookFilter] = useState(null) // 'fast' | 'mid' | null
  const [dietFilter, setDietFilter] = useState(null)

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
    setPicker(null); setQ(''); setCookFilter(null); setDietFilter(null)
    setSlots((s) => s.map((x) => x.id === slot.id ? { ...x, recipe_id: recipeId, recipe: recipes.find((r) => r.id === recipeId) } : x))
    try { await assignSlot(slot.id, recipeId) } catch (e) { toast.error(e.message) }
  }

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (picker && !r.meal_types.includes(picker.meal)) return false
      if (q && !`${r.title} ${r.cuisine} ${(r.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false
      const cook = (r.prep_minutes || 0) + (r.cook_minutes || 0)
      if (cookFilter === 'fast' && cook > 30) return false
      if (cookFilter === 'mid' && (cook <= 30 || cook > 60)) return false
      if (dietFilter && !(r.tags || []).includes(dietFilter)) return false
      return true
    })
  }, [recipes, picker, q, cookFilter, dietFilter])

  if (loading) return <div className="screen no-nav"><SizzleLoader message="Loading planner…" /></div>

  const byDate = {}
  slots.forEach((s) => (byDate[s.slot_date] ||= []).push(s))
  const dates = Object.keys(byDate).sort()
  const filled = slots.filter((s) => s.recipe_id).length

  // dietary chips available from the user's own tags
  const dietTags = [...new Set(recipes.flatMap((r) => r.tags || []))].slice(0, 8)

  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 6 }}>
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
        <div>
          <h1 style={{ fontSize: 24 }}>Build your plan</h1>
          <div className="mp-sub">Tap a slot to add a recipe</div>
        </div>
      </div>

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
        <input className="input" placeholder="Search your recipes…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <Chip active={cookFilter === 'fast'} onClick={() => setCookFilter(cookFilter === 'fast' ? null : 'fast')}>Under 30m</Chip>
          <Chip active={cookFilter === 'mid'} onClick={() => setCookFilter(cookFilter === 'mid' ? null : 'mid')}>30–60m</Chip>
          {dietTags.map((t) => <Chip key={t} active={dietFilter === t} onClick={() => setDietFilter(dietFilter === t ? null : t)}>#{t}</Chip>)}
        </div>
        {picker?.recipe_id && <Button variant="soft" block onClick={() => pick(null)} style={{ marginBottom: 12 }}>Clear this slot</Button>}
        <div className="plan-picker">
          {filtered.map((r) => (
            <button key={r.id} className="plan-picker-item" onClick={() => pick(r.id)}>
              <div className="ppi-img">{r.image_url ? <img src={r.image_url} alt="" /> : <span className="ppi-initial">{(r.title || '?').charAt(0).toUpperCase()}</span>}</div>
              <div className="ppi-body"><b>{r.title}</b><span>{r.cuisine || '—'}{((r.prep_minutes || 0) + (r.cook_minutes || 0)) > 0 ? ` · ${formatTime((r.prep_minutes || 0) + (r.cook_minutes || 0))}` : ''}</span></div>
            </button>
          ))}
          {filtered.length === 0 && <p className="muted">No recipes match. Add more or adjust filters.</p>}
        </div>
      </Sheet>
    </div>
  )
}

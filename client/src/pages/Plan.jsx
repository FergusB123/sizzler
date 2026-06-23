import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, getPlanSlots, createPlan, assignSlot, listRecipes } from '../lib/api'
import { Button, EmptyState, SizzleLoader, Sheet, Badge, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import PushPrimer from '../components/PushPrimer'
import { MEAL_OPTIONS } from '../lib/constants'
import './plan.css'

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }
const dayName = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
const dayNum = (d) => new Date(d + 'T00:00:00').getDate()

export default function Plan() {
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useProfile()
  const [plan, setPlan] = useState(undefined) // undefined=loading, null=none
  const [slots, setSlots] = useState([])
  const [creating, setCreating] = useState(false)
  const [picker, setPicker] = useState(null) // slot being edited
  const [recipes, setRecipes] = useState([])
  const [showPrimer, setShowPrimer] = useState(false)

  const load = async () => {
    const p = await getActivePlan()
    setPlan(p)
    if (p) setSlots(await getPlanSlots(p.id))
  }
  useEffect(() => { load() }, [])
  useEffect(() => { listRecipes().then(setRecipes) }, [])

  async function makePlan() {
    setCreating(true)
    try {
      const p = await createPlan({
        startDate: new Date(),
        days: profile?.planning_horizon_days || 7,
        meals: profile?.planned_meals || ['breakfast', 'lunch', 'dinner'],
      })
      setPlan(p)
      setSlots(await getPlanSlots(p.id))
      setShowPrimer(true) // sensible moment to ask for notifications
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function pick(recipeId) {
    const slot = picker
    setPicker(null)
    setSlots((s) => s.map((x) => x.id === slot.id ? { ...x, recipe_id: recipeId, recipe: recipes.find((r) => r.id === recipeId) } : x))
    try { await assignSlot(slot.id, recipeId) } catch (e) { toast.error(e.message) }
  }

  async function swap(aId, bId) {
    aId = Number(aId); bId = Number(bId)
    const a = slots.find((s) => s.id === aId)
    const b = slots.find((s) => s.id === bId)
    if (!a || !b || aId === bId) return
    setSlots((s) => s.map((x) => x.id === aId ? { ...x, recipe_id: b.recipe_id, recipe: b.recipe } : x.id === bId ? { ...x, recipe_id: a.recipe_id, recipe: a.recipe } : x))
    try { await Promise.all([assignSlot(aId, b.recipe_id), assignSlot(bId, a.recipe_id)]) }
    catch (e) { toast.error(e.message) }
  }

  if (plan === undefined) return <div className="screen"><SizzleLoader message="Loading your plan…" /></div>

  if (!plan) {
    return (
      <div className="screen">
        <div className="topbar" style={{ padding: 0, marginBottom: 14 }}><h1>Plan</h1></div>
        <EmptyState icon="calendar" title="No plan yet"
          action={<Button lg loading={creating} onClick={makePlan}>Create a {profile?.planning_horizon_days || 7}-day plan</Button>}>
          Start a plan, then fill it by swiping through recipes or building it by hand.
        </EmptyState>
      </div>
    )
  }

  const filled = slots.filter((s) => s.recipe_id).length
  const byDate = {}
  slots.forEach((s) => (byDate[s.slot_date] ||= []).push(s))
  const dates = Object.keys(byDate).sort()
  const mealOrder = { breakfast: 0, lunch: 1, dinner: 2 }

  return (
    <div className="screen">
      <div className="topbar" style={{ padding: 0, marginBottom: 6 }}>
        <h1>Your plan</h1>
        <span className="plan-progress-pill">{filled}/{slots.length}</span>
      </div>
      <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>
        {new Date(plan.start_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – {new Date(plan.end_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
      </p>

      {filled < slots.length && (
        <div className="plan-fill-cta">
          <button className="plan-fill" onClick={() => navigate('/plan/swipe')}><span className="pf-ic"><Icon name="flame" size={18} /></span><b>Swipe to fill</b><small>Fast & fun</small></button>
          <button className="plan-fill ghost" onClick={() => navigate('/plan/manual')}><span className="pf-ic"><Icon name="pencil" size={18} /></span><b>Build by hand</b><small>Full control</small></button>
        </div>
      )}

      {/* Week grid — tap to edit, drag a filled card onto another to swap */}
      <div className="plan-grid" id="plan-grid">
        {dates.map((date) => (
          <div className="plan-day" key={date}>
            <div className="plan-day-head"><b>{dayName(date)}</b><span>{dayNum(date)}</span></div>
            <div className="plan-day-slots">
              {byDate[date].sort((a, b) => mealOrder[a.meal] - mealOrder[b.meal]).map((slot) => (
                <SlotCard key={slot.id} slot={slot} onTap={() => setPicker(slot)} onSwap={swap} allSlots={slots} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {filled === slots.length && (
        <Button block lg className="plan-shop-cta" onClick={() => navigate('/shopping')}><Icon name="cart" size={18} /> Generate shopping list</Button>
      )}

      {/* Recipe picker sheet */}
      <Sheet open={!!picker} onClose={() => setPicker(null)} title={picker ? `${MEAL_LABEL[picker.meal]} · ${dayName(picker.slot_date)}` : ''}>
        {picker?.recipe_id && (
          <Button variant="soft" block onClick={() => pick(null)} style={{ marginBottom: 14 }}>Clear this slot</Button>
        )}
        <div className="plan-picker">
          {recipes.filter((r) => !picker || r.meal_types.includes(picker.meal)).map((r) => (
            <button key={r.id} className="plan-picker-item" onClick={() => pick(r.id)}>
              <div className="ppi-img">{r.image_url ? <img src={r.image_url} alt="" /> : <span className="ppi-initial">{(r.title || '?').charAt(0).toUpperCase()}</span>}</div>
              <div className="ppi-body"><b>{r.title}</b><span>{r.cuisine || '—'}</span></div>
            </button>
          ))}
          {recipes.length === 0 && <p className="muted">No recipes yet. Add some first.</p>}
        </div>
      </Sheet>

      <PushPrimer open={showPrimer} onClose={() => setShowPrimer(false)} />
    </div>
  )
}

// A slot: draggable when filled, drop-swaps with the slot it's released over.
function SlotCard({ slot, onTap, onSwap }) {
  const ref = useRef(null)
  const recipe = slot.recipe
  const filled = !!slot.recipe_id

  function handleDragEnd(_e, info) {
    const el = document.elementFromPoint(info.point.x, info.point.y)
    const target = el?.closest('[data-slot-id]')
    const targetId = target?.getAttribute('data-slot-id')
    // data-slot-id is a string; slot ids are numbers — compare/cast as strings.
    if (targetId && targetId !== String(slot.id)) onSwap(slot.id, targetId)
  }

  return (
    <motion.button
      ref={ref}
      data-slot-id={slot.id}
      className={`slot ${filled ? 'filled' : 'empty'}`}
      onTap={onTap}
      drag={filled}
      dragSnapToOrigin
      whileDrag={{ scale: 1.06, zIndex: 50, boxShadow: '0 18px 40px rgba(0,0,0,0.25)' }}
      onDragEnd={handleDragEnd}
      dragElastic={0.2}
    >
      <span className="slot-meal">{slot.meal[0].toUpperCase()}</span>
      {filled ? (
        <>
          {recipe?.image_url ? <img className="slot-img" src={recipe.image_url} alt="" /> : <span className="slot-initial">{(recipe?.title || '?').charAt(0).toUpperCase()}</span>}
          <span className="slot-title">{recipe?.title || 'Recipe'}</span>
        </>
      ) : (
        <span className="slot-add">+</span>
      )}
    </motion.button>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getActivePlan, getPlanSlots, getShoppingList, saveShoppingList,
  updateShoppingItem, addManualShoppingItem,
} from '../lib/api'
import { buildShoppingList, shoppingListStale, CATEGORIES } from '../lib/shoppingList'
import { Button, EmptyState, SizzleLoader, Segmented, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import './shopping.css'

// Two modes:
//   home    → pantry check: tick "I already have this" (have_at_home)
//   instore → shopping: tick items into the cart (in_cart)
export default function Shopping() {
  const navigate = useNavigate()
  const toast = useToast()
  const [plan, setPlan] = useState(undefined)
  const [items, setItems] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('home')
  const [newItem, setNewItem] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const p = await getActivePlan()
    setPlan(p)
    if (!p) { setLoading(false); return }
    const [existing, s] = await Promise.all([getShoppingList(p.id), getPlanSlots(p.id)])
    setItems(existing)
    setSlots(s)
    setLoading(false)
  }

  async function regenerate() {
    setLoading(true)
    try {
      const slots = await getPlanSlots(plan.id)
      const generated = buildShoppingList(slots)
      const manual = items.filter((i) => i.manual)
      const saved = await saveShoppingList(plan.id, generated)
      setItems([...saved, ...manual])
      toast.success('Shopping list ready')
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function toggle(item) {
    const field = mode === 'home' ? 'have_at_home' : 'in_cart'
    const next = !item[field]
    setItems((arr) => arr.map((x) => x.id === item.id ? { ...x, [field]: next } : x))
    try { await updateShoppingItem(item.id, { [field]: next }) } catch (e) { toast.error(e.message) }
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.trim()) return
    try {
      const created = await addManualShoppingItem(plan.id, newItem.trim())
      setItems((a) => [...a, created])
      setNewItem('')
    } catch (e) { toast.error(e.message) }
  }

  function finishShopping() {
    toast.success("Nice — you're all stocked up!")
    navigate('/')
  }

  async function resetChecks() {
    const field = mode === 'home' ? 'have_at_home' : 'in_cart'
    const toReset = items.filter((i) => i[field])
    setItems((arr) => arr.map((x) => ({ ...x, [field]: false })))
    try { await Promise.all(toReset.map((i) => updateShoppingItem(i.id, { [field]: false }))) } catch { /* ignore */ }
  }

  if (loading) return <div className="screen"><SizzleLoader message="Sorting your aisles…" /></div>

  if (plan === null) {
    return (
      <div className="screen">
        <div className="topbar" style={{ padding: 0, marginBottom: 14 }}><h1>Shopping</h1></div>
        <EmptyState icon="cart" title="No active plan" action={<Button onClick={() => navigate('/plan')}>Plan some meals</Button>}>
          Your shopping list builds itself from your meal plan. Create a plan to get started.
        </EmptyState>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="screen">
        <div className="topbar" style={{ padding: 0, marginBottom: 14 }}><h1>Shopping</h1></div>
        <EmptyState icon="sparkle" title="Ready to build your list"
          action={<Button lg onClick={regenerate}>Generate from plan</Button>}>
          We'll combine ingredients across every meal and sort them by aisle.
        </EmptyState>
      </div>
    )
  }

  // Group by category, hide items already "have at home" from the in-store view.
  const visible = mode === 'instore' ? items.filter((i) => !i.have_at_home) : items
  const grouped = CATEGORIES.map((c) => ({ ...c, list: visible.filter((i) => i.category === c.key) })).filter((g) => g.list.length)
  const doneField = mode === 'home' ? 'have_at_home' : 'in_cart'
  const doneCount = visible.filter((i) => i[doneField]).length
  const allDone = mode === 'instore' && visible.length > 0 && doneCount === visible.length
  const stale = shoppingListStale(slots, items)

  return (
    <div className="screen">
      <div className="topbar" style={{ padding: 0, marginBottom: 10 }}>
        <h1>Shopping list</h1>
        <button className="link" onClick={regenerate} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontWeight: 600, cursor: 'pointer' }}>Rebuild</button>
      </div>

      <Segmented
        className="seg-dark"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'home', label: <><span className="seg-emoji">🏠</span> At home</> },
          { value: 'instore', label: <><span className="seg-emoji">🛒</span> In store</> },
        ]}
      />
      <p className="shop-hint">
        {mode === 'home' ? <>Tick off what you <b>already have</b> before you shop.</> : 'Tick items into your trolley as you shop.'}
      </p>

      {stale && (
        <div className="shop-stale">
          <div className="shop-stale-txt"><b>Your plan changed</b><span>Rebuild to match your latest dinners.</span></div>
          <Button sm onClick={regenerate}>Rebuild</Button>
        </div>
      )}

      <div className="shop-progress">
        <div className="shop-progress-head"><span>{doneCount} of {visible.length} done</span><b>{Math.max(0, visible.length - doneCount)}</b></div>
        <div className="shop-progress-track"><span style={{ width: `${visible.length ? (doneCount / visible.length) * 100 : 0}%` }} /></div>
      </div>

      {allDone && (
        <div className="shop-done">
          <div className="shop-done-ic"><Icon name="check" size={28} /></div>
          <b>That's everything!</b>
          <p>Your trolley's full for the week's dinners.</p>
          <Button lg onClick={finishShopping}>Finish shopping</Button>
          <button className="shop-reset" onClick={resetChecks}>Uncheck all</button>
        </div>
      )}

      {grouped.map((g) => (
        <div key={g.key} className="shop-group">
          <h3 className="shop-cat">{g.label}<small>{g.list.length}</small></h3>
          {g.list.map((item) => {
            const checked = item[doneField]
            return (
              <button key={item.id} className={`shop-item ${checked ? 'checked' : ''}`} onClick={() => toggle(item)}>
                <span className={`shop-check ${checked ? 'on' : ''}`}>{checked ? <Icon name="check" size={14} /> : null}</span>
                <span className="shop-name">{item.name}</span>
                <span className="shop-amount">
                  {item.quantity ? <span className="shop-qty">{item.quantity}</span> : null}
                  {item.unit ? <span className="shop-unit">{item.unit}</span> : null}
                </span>
              </button>
            )
          })}
        </div>
      ))}

      <form className="shop-add" onSubmit={addItem}>
        <input className="input" placeholder="Add something else…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
        <Button type="submit" variant="soft">Add</Button>
      </form>
    </div>
  )
}

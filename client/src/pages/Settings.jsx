import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { useAuth } from '../context/AuthContext'
import { Button, Chip, Sheet, IconButton, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { MEAL_OPTIONS, DIETARY_OPTIONS, dietLabel } from '../lib/constants'
import { enablePush, disablePush, permissionState } from '../lib/push'
import './pages.css'

export default function Settings() {
  const { profile, update } = useProfile()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [editing, setEditing] = useState(null) // 'household' | 'meals' | 'horizon' | 'diet'
  const [pushBusy, setPushBusy] = useState(false)
  const p = profile || {}

  async function save(patch) {
    try { await update(patch); setEditing(null) }
    catch (e) { toast.error(e.message) }
  }

  async function togglePush() {
    setPushBusy(true)
    try {
      if (p.push_enabled) { await disablePush(); await update({ push_enabled: false }); toast.show('Reminders off') }
      else { const ok = await enablePush(); if (ok) toast.success('Reminders on'); else toast.error('Permission denied') }
    } catch (e) { toast.error(e.message) }
    finally { setPushBusy(false) }
  }

  const householdLabel = p.household_kind === 'family' ? `Family of ${p.household_size}` : p.household_kind === 'solo' ? 'Solo' : 'Couple'

  return (
    <div className="screen">
      <div style={{ marginBottom: 18 }}>
        <div className="overline">{p.display_name || 'Your account'}</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.03em', marginTop: 4 }}>You</h1>
      </div>

      <div className="settings-group">
        <h4>Planning preferences</h4>
        <button className="settings-row" onClick={() => setEditing('household')} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer' }}>
          <span className="lbl">Household</span><span className="spacer" /><span className="val">{householdLabel}</span><Icon name="chevron" size={16} className="row-chevron" />
        </button>
        <button className="settings-row" onClick={() => setEditing('meals')} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer' }}>
          <span className="lbl">Meals planned</span><span className="spacer" /><span className="val">{(p.planned_meals || []).length} selected</span><Icon name="chevron" size={16} className="row-chevron" />
        </button>
        <button className="settings-row" onClick={() => setEditing('horizon')} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer' }}>
          <span className="lbl">Planning horizon</span><span className="spacer" /><span className="val">{p.planning_horizon_days} days</span><Icon name="chevron" size={16} className="row-chevron" />
        </button>
        <button className="settings-row" onClick={() => setEditing('diet')} style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
          <span className="lbl">Dietary needs</span><span className="spacer" /><span className="val">{(p.dietary_prefs || []).length ? `${p.dietary_prefs.length} set` : 'None'}</span><Icon name="chevron" size={16} className="row-chevron" />
        </button>
      </div>

      <div className="settings-group">
        <h4>Notifications</h4>
        <div className="settings-row">
          <div>
            <div className="lbl">Replanning reminders</div>
            <div className="val">Get nudged before your plan runs out</div>
          </div>
          <span className="spacer" />
          {permissionState() === 'unsupported'
            ? <span className="val">Unsupported</span>
            : <button className={`switch ${p.push_enabled ? 'on' : ''}`} disabled={pushBusy} onClick={togglePush} aria-label="Toggle reminders" />}
        </div>
      </div>

      <div className="settings-group">
        <h4>Account</h4>
        <div className="settings-row"><span className="lbl">Name</span><span className="spacer" /><span className="val">{p.display_name}</span></div>
      </div>

      <Button variant="soft" block onClick={async () => { await signOut() }}>Sign out</Button>
      <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 16 }}>Sizzler · v0.1</p>

      {/* ---- Edit sheets ---- */}
      <Sheet open={editing === 'household'} onClose={() => setEditing(null)} title="Household">
        <EditHousehold p={p} onSave={save} />
      </Sheet>
      <Sheet open={editing === 'meals'} onClose={() => setEditing(null)} title="Meals you plan for">
        <EditMeals p={p} onSave={save} />
      </Sheet>
      <Sheet open={editing === 'horizon'} onClose={() => setEditing(null)} title="Planning horizon">
        <EditHorizon p={p} onSave={save} />
      </Sheet>
      <Sheet open={editing === 'diet'} onClose={() => setEditing(null)} title="Dietary needs">
        <EditDiet p={p} onSave={save} />
      </Sheet>
    </div>
  )
}

function EditHousehold({ p, onSave }) {
  const [kind, setKind] = useState(p.household_kind)
  const [size, setSize] = useState(p.household_size || 3)
  return (
    <div style={{ paddingTop: 8 }}>
      <div className="chip-row" style={{ marginBottom: 16 }}>
        {[['solo', 'Solo'], ['couple', 'Couple'], ['family', 'Family']].map(([k, l]) => (
          <Chip key={k} flame active={kind === k} onClick={() => setKind(k)}>{l}</Chip>
        ))}
      </div>
      {kind === 'family' && (
        <div className="onb-stepper" style={{ marginBottom: 16 }}>
          <span>How many?</span>
          <div className="stepper">
            <button onClick={() => setSize((s) => Math.max(3, s - 1))}>−</button><b>{size}</b>
            <button onClick={() => setSize((s) => Math.min(12, s + 1))}>+</button>
          </div>
        </div>
      )}
      <Button block onClick={() => onSave({ household_kind: kind, household_size: kind === 'solo' ? 1 : kind === 'couple' ? 2 : size })}>Save</Button>
    </div>
  )
}

function EditMeals({ p, onSave }) {
  const [meals, setMeals] = useState(p.planned_meals || [])
  const toggle = (v) => setMeals((m) => m.includes(v) ? m.filter((x) => x !== v) : [...m, v])
  return (
    <div style={{ paddingTop: 8 }}>
      <div className="chip-row" style={{ marginBottom: 16 }}>
        {MEAL_OPTIONS.map((m) => <Chip key={m.value} flame active={meals.includes(m.value)} onClick={() => toggle(m.value)}>{m.icon} {m.label}</Chip>)}
      </div>
      <Button block disabled={!meals.length} onClick={() => onSave({ planned_meals: meals })}>Save</Button>
    </div>
  )
}

function EditHorizon({ p, onSave }) {
  const [days, setDays] = useState(p.planning_horizon_days || 7)
  return (
    <div style={{ paddingTop: 8 }}>
      <div className="onb-stepper" style={{ marginBottom: 16 }}>
        <span>Days per plan</span>
        <div className="stepper">
          <button onClick={() => setDays((d) => Math.max(1, d - 1))}>−</button><b>{days}</b>
          <button onClick={() => setDays((d) => Math.min(30, d + 1))}>+</button>
        </div>
      </div>
      <Button block onClick={() => onSave({ planning_horizon_days: days })}>Save</Button>
    </div>
  )
}

function EditDiet({ p, onSave }) {
  const known = DIETARY_OPTIONS.map((d) => d.value)
  const [diet, setDiet] = useState((p.dietary_prefs || []).filter((d) => known.includes(d)))
  const [custom, setCustom] = useState((p.dietary_prefs || []).filter((d) => !known.includes(d)).join(', '))
  const toggle = (v) => setDiet((m) => m.includes(v) ? m.filter((x) => x !== v) : [...m, v])
  return (
    <div style={{ paddingTop: 8 }}>
      <div className="chip-row" style={{ marginBottom: 14 }}>
        {DIETARY_OPTIONS.map((d) => <Chip key={d.value} fresh active={diet.includes(d.value)} onClick={() => toggle(d.value)}>{d.label}</Chip>)}
      </div>
      <input className="input" placeholder="Custom, comma separated" value={custom} onChange={(e) => setCustom(e.target.value)} style={{ marginBottom: 16 }} />
      <Button block onClick={() => onSave({ dietary_prefs: [...diet, ...custom.split(',').map((s) => s.trim()).filter(Boolean)] })}>Save</Button>
    </div>
  )
}

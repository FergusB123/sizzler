import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProfile } from '../context/ProfileContext'
import { completeOnboarding } from '../lib/api'
import { Button, Chip, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { DIETARY_OPTIONS } from '../lib/constants'
import './onboarding.css'

const HOUSEHOLDS = [
  { k: 'solo', icon: 'user', title: 'Just me', desc: 'Solo cooking, 1 portion' },
  { k: 'couple', icon: 'users', title: 'A couple', desc: 'Two of us, 2 portions' },
  { k: 'family', icon: 'users', title: 'A family', desc: 'Bigger batches' },
]
const MEALS = [
  { k: 'breakfast', emoji: '🍳', title: 'Breakfast', desc: 'Start the day right' },
  { k: 'lunch', emoji: '🥗', title: 'Lunch', desc: 'Midday fuel' },
  { k: 'dinner', emoji: '🍽️', title: 'Dinner', desc: 'The main event' },
]

export default function Onboarding() {
  const { refresh, profile } = useProfile()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [household, setHousehold] = useState('couple')
  const [size, setSize] = useState(3)
  const [meals, setMeals] = useState(['breakfast', 'lunch', 'dinner'])
  const [horizon, setHorizon] = useState(7)
  const [custom, setCustom] = useState(false)
  const [diet, setDiet] = useState([])
  const [customDiet, setCustomDiet] = useState('')

  const toggleMeal = (v) => setMeals((m) => m.includes(v) ? m.filter((x) => x !== v) : [...m, v])
  const toggleDiet = (v) => setDiet((d) => d.includes(v) ? d.filter((x) => x !== v) : [...d, v])

  async function finish() {
    setBusy(true)
    try {
      const dietary = [...diet]
      if (customDiet.trim()) dietary.push(customDiet.trim())
      await completeOnboarding({
        household_kind: household,
        household_size: household === 'solo' ? 1 : household === 'couple' ? 2 : Math.max(3, Number(size) || 3),
        planned_meals: meals.length ? meals : ['dinner'],
        planning_horizon_days: horizon,
        dietary_prefs: dietary,
        display_name: profile?.display_name,
      })
      await refresh()
    } catch (err) {
      toast.error(err.message || 'Could not save your preferences')
      setBusy(false)
    }
  }

  const canNext = (step === 0 && !!household) || (step === 1 && meals.length > 0) || step >= 2

  return (
    <div className="onb">
      <div className="onb-top">
        {step > 0 && <button className="onb-back" onClick={() => setStep((s) => s - 1)} aria-label="Back"><Icon name="arrowLeft" size={18} /></button>}
        <div className="onb-bar"><span style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
        <span className="onb-count">{step + 1} of 4</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} className="onb-step"
          initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>

          {step === 0 && (
            <>
              <h1>Who are we cooking for?</h1>
              <p className="onb-sub">This helps us scale recipes and your shopping list.</p>
              <div className="onb-rows">
                {HOUSEHOLDS.map((h) => (
                  <button key={h.k} className={`onb-row ${household === h.k ? 'sel' : ''}`} onClick={() => setHousehold(h.k)}>
                    <span className="onb-row-ic"><Icon name={h.icon} size={20} /></span>
                    <div><b>{h.title}</b><span>{h.desc}</span></div>
                  </button>
                ))}
              </div>
              {household === 'family' && (
                <div className="onb-stepper">
                  <span>How many?</span>
                  <div className="stepper">
                    <button onClick={() => setSize((s) => Math.max(3, s - 1))}><Icon name="minus" size={16} /></button>
                    <b>{Math.max(3, size)}</b>
                    <button onClick={() => setSize((s) => Math.min(12, s + 1))}><Icon name="plus" size={16} /></button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h1>Which meals should we plan?</h1>
              <p className="onb-sub">Pick any — you can change this any time.</p>
              <div className="onb-rows">
                {MEALS.map((m) => (
                  <button key={m.k} className={`onb-row check ${meals.includes(m.k) ? 'sel' : ''}`} onClick={() => toggleMeal(m.k)}>
                    <span className="onb-row-ic emoji">{m.emoji}</span>
                    <div><b>{m.title}</b><span>{m.desc}</span></div>
                    <span className="onb-check">{meals.includes(m.k) ? <Icon name="check" size={15} /> : null}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1>How far ahead do you plan?</h1>
              <p className="onb-sub">We'll build your plan and shopping list for this window.</p>
              <div className="onb-grid">
                {[3, 5, 7].map((d) => (
                  <button key={d} className={`onb-card ${!custom && horizon === d ? 'sel' : ''}`} onClick={() => { setCustom(false); setHorizon(d) }}>
                    <span className="big">{d}</span>{d === 7 ? 'a full week' : 'days'}
                  </button>
                ))}
                <button className={`onb-card ${custom ? 'sel' : ''}`} onClick={() => setCustom(true)}>
                  <span className="big"><Icon name="pencil" size={22} /></span>custom
                </button>
              </div>
              {custom && (
                <div className="onb-stepper">
                  <span>Days per plan</span>
                  <div className="stepper">
                    <button onClick={() => setHorizon((h) => Math.max(1, h - 1))}><Icon name="minus" size={16} /></button>
                    <b>{horizon}</b>
                    <button onClick={() => setHorizon((h) => Math.min(30, h + 1))}><Icon name="plus" size={16} /></button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1>Any dietary preferences?</h1>
              <p className="onb-sub">We'll keep these in mind for every recipe we suggest.</p>
              <div className="chip-row">
                {DIETARY_OPTIONS.map((d) => (
                  <Chip key={d.value} fresh active={diet.includes(d.value)} onClick={() => toggleDiet(d.value)}>{d.label}</Chip>
                ))}
              </div>
              <input className="input" style={{ marginTop: 16 }} placeholder="Anything else? e.g. low-carb, no pork"
                value={customDiet} onChange={(e) => setCustomDiet(e.target.value)} />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="onb-actions">
        {step < 3 ? (
          <Button block lg disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Button>
        ) : (
          <Button block lg loading={busy} onClick={finish}>Start cooking</Button>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProfile } from '../context/ProfileContext'
import { completeOnboarding } from '../lib/api'
import { Button, Chip, useToast } from '../components/ui/primitives'
import { DIETARY_OPTIONS, MEAL_OPTIONS } from '../lib/constants'
import './onboarding.css'

export default function Onboarding() {
  const { refresh, profile } = useProfile()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [household, setHousehold] = useState('couple')
  const [size, setSize] = useState(2)
  const [meals, setMeals] = useState(['breakfast', 'lunch', 'dinner'])
  const [horizon, setHorizon] = useState(7)
  const [diet, setDiet] = useState([])
  const [customDiet, setCustomDiet] = useState('')

  const steps = ['Household', 'Meals', 'Horizon', 'Diet']

  const toggle = (list, set, value) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  async function finish() {
    setBusy(true)
    try {
      const dietary = [...diet]
      if (customDiet.trim()) dietary.push(customDiet.trim())
      await completeOnboarding({
        household_kind: household,
        household_size: household === 'solo' ? 1 : household === 'couple' ? 2 : Math.max(1, Number(size) || 3),
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

  const canNext =
    (step === 0 && !!household) ||
    (step === 1 && meals.length > 0) ||
    step === 2 ||
    step === 3

  return (
    <div className="onb">
      <div className="onb-progress">
        {steps.map((s, i) => (
          <span key={s} className={`onb-dot ${i <= step ? 'on' : ''}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} className="onb-step"
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>

          {step === 0 && (
            <>
              <h1>Who's cooking?</h1>
              <p className="onb-sub">We'll scale portions and shopping to suit.</p>
              <div className="onb-cards">
                {[['solo', '1', 'Solo'], ['couple', '2', 'Couple'], ['family', '3+', 'Family']].map(([k, e, l]) => (
                  <button key={k} className={`onb-card ${household === k ? 'sel' : ''}`} onClick={() => setHousehold(k)}>
                    <span className="big">{e}</span>{l}
                  </button>
                ))}
              </div>
              {household === 'family' && (
                <div className="onb-stepper">
                  <span>How many?</span>
                  <div className="stepper">
                    <button onClick={() => setSize((s) => Math.max(3, s - 1))}>−</button>
                    <b>{Math.max(3, size)}</b>
                    <button onClick={() => setSize((s) => Math.min(12, s + 1))}>+</button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h1>Which meals?</h1>
              <p className="onb-sub">Pick everything you'd like to plan for.</p>
              <div className="chip-row">
                {MEAL_OPTIONS.map((m) => (
                  <Chip key={m.value} flame active={meals.includes(m.value)} onClick={() => toggle(meals, setMeals, m.value)}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1>How far ahead?</h1>
              <p className="onb-sub">How many days each plan should cover.</p>
              <div className="onb-cards horizon">
                {[3, 5, 7].map((d) => (
                  <button key={d} className={`onb-card ${horizon === d ? 'sel' : ''}`} onClick={() => setHorizon(d)}>
                    <span className="big">{d}</span>days
                  </button>
                ))}
              </div>
              <div className="onb-stepper">
                <span>Custom</span>
                <div className="stepper">
                  <button onClick={() => setHorizon((h) => Math.max(1, h - 1))}>−</button>
                  <b>{horizon}</b>
                  <button onClick={() => setHorizon((h) => Math.min(30, h + 1))}>+</button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Any dietary needs?</h1>
              <p className="onb-sub">We'll factor these into suggestions. You can change them later.</p>
              <div className="chip-row">
                {DIETARY_OPTIONS.map((d) => (
                  <Chip key={d.value} active={diet.includes(d.value)} onClick={() => toggle(diet, setDiet, d.value)}>
                    {d.label}
                  </Chip>
                ))}
              </div>
              <input className="input" style={{ marginTop: 14 }} placeholder="Anything else? e.g. low-carb, no pork"
                value={customDiet} onChange={(e) => setCustomDiet(e.target.value)} />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="onb-actions">
        {step > 0 && <Button variant="soft" onClick={() => setStep((s) => s - 1)}>Back</Button>}
        {step < steps.length - 1 ? (
          <Button block={step === 0} disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Button>
        ) : (
          <Button block={false} loading={busy} onClick={finish}>Start cooking →</Button>
        )}
      </div>
    </div>
  )
}

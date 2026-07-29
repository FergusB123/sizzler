import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, getPlanSlots, todayISO } from '../lib/api'
import { IconButton, Segmented } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { useGoBack } from '../lib/useGoBack'
import { weekStartFor, addDays, formatRange, suggestedNextStart, getPlanPhase } from '../lib/planPhase'
import './plan.css'

// "Which week, and how do you want to build it?" Plans are anchored to the
// user's week-start day so "this week" / "next week" mean something concrete.
export default function PlanChoose() {
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const { profile } = useProfile()

  const anchor = profile?.week_start_day ?? 1
  const today = todayISO()
  const thisWeekMon = weekStartFor(today, anchor)
  const nextWeek = addDays(thisWeekMon, 7)

  const [start, setStart] = useState(today)
  const [current, setCurrent] = useState(undefined)

  // Default to whichever week actually needs planning next, clamped to the two
  // options so the toggle always has a selection.
  useEffect(() => {
    (async () => {
      const p = await getActivePlan()
      const s = p ? await getPlanSlots(p.id) : []
      // A blank plan (nothing chosen) doesn't count as a current plan.
      const real = p && s.some((x) => x.recipe_id) ? p : null
      setCurrent(real)
      const live = !!real && getPlanPhase(real, today).phase !== 'ended'
      const suggested = suggestedNextStart(real, today, anchor)
      setStart(suggested >= nextWeek ? nextWeek : (live ? thisWeekMon : today))
    })()
  }, [anchor])

  const phase = current ? getPlanPhase(current, today).phase : 'none'
  const livePlan = !!current && phase !== 'ended'
  // A brand-new plan starts today; only when a live current-week plan already
  // exists does "this week" align to the anchored Monday (so it replaces it).
  const thisWeekStart = livePlan ? thisWeekMon : today
  const replacingLive = livePlan && start === current.start_date
  const go = (path) => navigate(path, { state: { startDate: start } })

  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 8 }}>
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
      </div>
      <h1 className="choose-h">Plan your week</h1>

      <div className="week-pick">
        <Segmented
          value={start}
          onChange={setStart}
          options={[
            { value: thisWeekStart, label: 'This week' },
            { value: nextWeek, label: 'Next week' },
          ]}
        />
        <p className="week-pick-range">{formatRange(start, addDays(start, 6))}</p>
        {replacingLive && (
          <p className="week-pick-warn">
            <Icon name="info" size={15} /> You already have a plan for this week — building a new one replaces it.
          </p>
        )}
      </div>

      <button className="choose-card swipe" onClick={() => go('/plan/swipe')}>
        <div className="choose-top">
          <span className="choose-ic"><Icon name="flame" size={22} /></span>
          <span className="choose-badge">FUN</span>
        </div>
        <b>Swipe to plan</b>
        <p>Swipe through your recipes and the community. We auto-build a balanced week from your picks.</p>
      </button>

      <button className="choose-card build" onClick={() => go('/plan/manual')}>
        <span className="choose-ic"><Icon name="calendar" size={22} /></span>
        <b>Build it yourself</b>
        <p>Drop recipes straight into a day-by-day grid. Full control, your way.</p>
      </button>
    </div>
  )
}

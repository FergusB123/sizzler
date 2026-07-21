import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import { getActivePlan, getShoppingList, getPlanSlots, todayISO } from '../lib/api'
import { getPlanPhase, planProgress } from '../lib/planPhase'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [shopCount, setShopCount] = useState(0)
  const [planState, setPlanState] = useState({ live: false, needsAttention: false })

  // Badge: items still to buy (not already-have, not in cart) on the active plan.
  // Plan tab: where it goes — and whether it needs attention — depends on the
  // plan's phase, so a finished week sends you to the builder, not the corpse.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const plan = await getActivePlan()
        if (!alive) return
        if (!plan) { setPlanState({ live: false, needsAttention: true }); return }
        const [items, slots] = await Promise.all([getShoppingList(plan.id), getPlanSlots(plan.id)])
        if (!alive) return
        const today = todayISO()
        const { phase } = getPlanPhase(plan, today)
        const prog = planProgress(slots, today)
        const live = phase === 'active' || phase === 'final' || phase === 'upcoming'
        setPlanState({
          live: live && prog.totalFilled > 0,
          needsAttention: phase === 'ended' || prog.totalFilled === 0 || prog.emptyUpcoming > 0,
        })
        setShopCount(items.filter((i) => !i.have_at_home && !i.in_cart).length)
      } catch { /* ignore */ }
    })()
    return () => { alive = false }
  }, [location.pathname])

  const link = (to, end, icon, label, badge) => (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="ic">
        <Icon name={icon} size={23} />
        {badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
      </span>
      {label}
    </NavLink>
  )

  // Plan tab: open the current plan if one exists, else the plan builder.
  const planActive = location.pathname.startsWith('/plan')
  return (
    <nav className="bottom-nav">
      {link('/', true, 'house', 'Home')}
      {link('/recipes', false, 'bookmark', 'Recipes')}
      <button className="nav-fab" aria-label="Add recipe" onClick={() => navigate('/add')}>
        <Icon name="plus" size={22} />
      </button>
      {link('/shopping', false, 'cart', 'Shop', shopCount)}
      <button className={`nav-item ${planActive ? 'active' : ''}`} onClick={() => navigate(planState.live ? '/plan/manual' : '/plan')}>
        <span className="ic">
          <Icon name="calendar" size={23} />
          {planState.needsAttention && <span className="nav-dot" aria-label="Needs planning" />}
        </span>
        Plan
      </button>
    </nav>
  )
}

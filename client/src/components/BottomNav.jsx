import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import { getActivePlan, getShoppingList } from '../lib/api'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [shopCount, setShopCount] = useState(0)
  const [hasPlan, setHasPlan] = useState(false)

  // Badge: items still to buy (not already-have, not in cart) on the active plan.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const plan = await getActivePlan()
        if (!alive) return
        setHasPlan(!!plan)
        if (!plan) return
        const items = await getShoppingList(plan.id)
        const n = items.filter((i) => !i.have_at_home && !i.in_cart).length
        if (alive) setShopCount(n)
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
      <button className={`nav-item ${planActive ? 'active' : ''}`} onClick={() => navigate(hasPlan ? '/plan/manual' : '/plan')}>
        <span className="ic"><Icon name="calendar" size={23} /></span>
        Plan
      </button>
    </nav>
  )
}

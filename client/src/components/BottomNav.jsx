import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { getActivePlan, getShoppingList } from '../lib/api'

export default function BottomNav() {
  const navigate = useNavigate()
  const [shopCount, setShopCount] = useState(0)

  // Badge: items still to buy (not already-have, not in cart) on the active plan.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const plan = await getActivePlan()
        if (!plan) return
        const items = await getShoppingList(plan.id)
        const n = items.filter((i) => !i.have_at_home && !i.in_cart).length
        if (alive) setShopCount(n)
      } catch { /* ignore */ }
    })()
    return () => { alive = false }
  }, [])

  const link = (to, end, icon, label, badge) => (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="ic">
        <Icon name={icon} size={23} />
        {badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
      </span>
      {label}
    </NavLink>
  )
  return (
    <nav className="bottom-nav">
      {link('/', true, 'house', 'Home')}
      {link('/recipes', false, 'bookmark', 'Recipes')}
      <button className="nav-fab" aria-label="Add recipe" onClick={() => navigate('/add')}>
        <Icon name="plus" size={22} />
      </button>
      {link('/shopping', false, 'cart', 'Shop', shopCount)}
      {link('/settings', false, 'user', 'You')}
    </nav>
  )
}

import { NavLink, useNavigate } from 'react-router-dom'
import Icon from './Icon'

export default function BottomNav() {
  const navigate = useNavigate()
  const link = (to, end, icon, label) => (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="ic"><Icon name={icon} size={23} /></span>{label}
    </NavLink>
  )
  return (
    <nav className="bottom-nav">
      {link('/', true, 'home', 'Home')}
      {link('/recipes', false, 'book', 'Recipes')}
      <button className="nav-fab" aria-label="Add recipe" onClick={() => navigate('/add')}>
        <Icon name="plus" size={22} />
      </button>
      {link('/plan', false, 'calendar', 'Plan')}
      {link('/shopping', false, 'cart', 'Shop')}
    </nav>
  )
}

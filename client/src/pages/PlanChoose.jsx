import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { IconButton } from '../components/ui/primitives'
import Icon from '../components/Icon'
import './plan.css'

// "How do you want to plan?" — pick Swipe (fun, auto-build) or Build by hand.
export default function PlanChoose() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const days = profile?.planning_horizon_days || 7
  const meals = (profile?.planned_meals || ['breakfast', 'lunch', 'dinner']).length

  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 8 }}>
        <IconButton onClick={() => navigate('/')}><Icon name="arrowLeft" size={20} /></IconButton>
      </div>
      <h1 className="choose-h">How do you want to plan?</h1>
      <p className="muted" style={{ margin: '8px 0 24px', lineHeight: 1.5 }}>
        We'll fill {days} day{days === 1 ? '' : 's'} · {meals} meal{meals === 1 ? '' : 's'}/day and build your shopping list.
      </p>

      <button className="choose-card swipe" onClick={() => navigate('/plan/swipe')}>
        <div className="choose-top">
          <span className="choose-ic"><Icon name="flame" size={22} /></span>
          <span className="choose-badge">FUN</span>
        </div>
        <b>Swipe to plan</b>
        <p>Swipe through your recipes and the community. We auto-build a balanced week from your picks.</p>
      </button>

      <button className="choose-card build" onClick={() => navigate('/plan/manual')}>
        <span className="choose-ic"><Icon name="calendar" size={22} /></span>
        <b>Build it yourself</b>
        <p>Drop recipes straight into a day-by-day grid. Full control, your way.</p>
      </button>
    </div>
  )
}

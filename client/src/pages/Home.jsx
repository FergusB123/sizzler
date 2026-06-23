import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, getPlanSlots, listRecipes } from '../lib/api'
import RecipeCard from '../components/RecipeCard'
import Icon from '../components/Icon'
import { EmptyState, IconButton } from '../components/ui/primitives'
import './pages.css'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const ACTIONS = [
  { to: '/add', icon: 'sparkle', label: 'Add recipe' },
  { to: '/plan/swipe', icon: 'flame', label: 'Swipe a week' },
  { to: '/community', icon: 'globe', label: 'Discover' },
  { to: '/shopping', icon: 'cart', label: 'Shopping' },
]

export default function Home() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [plan, setPlan] = useState(null)
  const [slots, setSlots] = useState([])

  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([listRecipes(), getActivePlan()])
      setRecipes(r)
      setPlan(p)
      if (p) setSlots(await getPlanSlots(p.id))
    })()
  }, [])

  const filled = slots.filter((s) => s.recipe_id).length
  const pct = slots.length ? Math.round((filled / slots.length) * 100) : 0
  const daysLeft = plan ? Math.max(0, Math.ceil((new Date(plan.end_date) - new Date()) / 86400000)) : null
  const name = profile?.display_name?.split(' ')[0] || 'there'

  return (
    <div className="screen home">
      <header className="home-head">
        <div>
          <div className="overline">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="home-greet">{greeting()},<br />{name}.</h1>
        </div>
        <IconButton aria-label="Settings" onClick={() => navigate('/settings')}><Icon name="settings" size={20} /></IconButton>
      </header>

      {plan ? (
        <Link to="/plan" className="plan-hero">
          <div className="plan-hero-top">
            <span className="overline accent">Current plan</span>
            <Icon name="arrowRight" size={18} />
          </div>
          <div className="plan-hero-figure"><b>{filled}</b><span>/ {slots.length} meals planned</span></div>
          <div className="plan-track"><span style={{ width: `${pct}%` }} /></div>
          <div className="plan-hero-foot">
            {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Ends today — plan the next one'}
          </div>
        </Link>
      ) : (
        <Link to="/plan" className="plan-hero empty-plan">
          <div className="plan-hero-top"><span className="overline accent">Get started</span><Icon name="arrowRight" size={18} /></div>
          <div className="plan-hero-figure big">Plan your week</div>
          <div className="plan-hero-foot">Swipe through recipes or build it by hand</div>
        </Link>
      )}

      <div className="bento">
        {ACTIONS.map((a) => (
          <button key={a.to} className="bento-tile" onClick={() => navigate(a.to)}>
            <span className="bento-ic"><Icon name={a.icon} size={20} /></span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      <div className="section-title">
        Your kitchen
        {recipes?.length ? <Link to="/recipes">All {recipes.length}</Link> : null}
      </div>
      {recipes === null ? (
        <div className="hscroll">{[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 220, flex: '0 0 60%' }} />)}</div>
      ) : recipes.length === 0 ? (
        <EmptyState icon="book" title="Your cookbook is empty"
          action={<button className="btn btn-primary" onClick={() => navigate('/add')}>Add your first recipe</button>}>
          Add by hand, paste a link, snap a page, or drop a social video.
        </EmptyState>
      ) : (
        <div className="hscroll">
          {recipes.slice(0, 6).map((r) => <RecipeCard key={r.id} recipe={r} to={`/recipes/${r.id}`} origin="you" />)}
        </div>
      )}
    </div>
  )
}

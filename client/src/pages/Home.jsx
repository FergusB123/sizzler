import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, getPlanSlots, listRecipes, iso } from '../lib/api'
import Icon from '../components/Icon'
import { SizzleLoader } from '../components/ui/primitives'
import './pages.css'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }
const mealOrder = { breakfast: 0, lunch: 1, dinner: 2 }
const weekday = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })
const shortDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })

function Thumb({ recipe, size = 44 }) {
  if (recipe?.image_url) return <img className="thumb" src={recipe.image_url} alt="" style={{ width: size, height: size }} />
  const h = ((recipe?.title || '').length % 5)
  return <span className={`thumb thumb-fb h${h}`} style={{ width: size, height: size }}>{(recipe?.title || '?').charAt(0).toUpperCase()}</span>
}

export default function Home() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [plan, setPlan] = useState(undefined)
  const [slots, setSlots] = useState([])

  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([listRecipes(), getActivePlan()])
      setRecipes(r)
      setPlan(p)
      setSlots(p ? await getPlanSlots(p.id) : [])
    })()
  }, [])

  const name = profile?.display_name?.split(' ')[0] || 'there'
  const initial = (profile?.display_name || '?').charAt(0).toUpperCase()

  if (plan === undefined || recipes === null) {
    return <div className="screen"><SizzleLoader message="Warming up your kitchen…" /></div>
  }

  const filled = slots.filter((s) => s.recipe_id)
  const hasPlan = filled.length > 0
  const planDays = plan ? Math.round((new Date(plan.end_date) - new Date(plan.start_date)) / 86400000) + 1 : 0

  // Build the "hero day" — today if it has meals, else the next day with meals.
  const today = iso(new Date())
  const dates = [...new Set(filled.map((s) => s.slot_date))].sort()
  const heroDate = dates.find((d) => d >= today) || dates[dates.length - 1]
  const heroSlots = filled.filter((s) => s.slot_date === heroDate).sort((a, b) => mealOrder[a.meal] - mealOrder[b.meal])
  const heroLabel = heroDate === today ? `Tonight · ${weekday(heroDate)}` : weekday(heroDate)

  const Header = (
    <header className="home-head">
      <div>
        <div className="overline">{greeting()}, {name}</div>
        <h1 className="home-greet">What's cooking?</h1>
      </div>
      <Link to="/settings" className="home-avatar" aria-label="You">{initial}</Link>
    </header>
  )

  return (
    <div className="screen home">
      {Header}

      {hasPlan ? (
        <>
          <Link to="/plan" className="cook-hero">
            <div className="cook-hero-top"><span className="overline accent">{heroLabel}</span><span>{planDays}-day plan</span></div>
            <div className="cook-hero-meals">
              {heroSlots.slice(0, 3).map((s) => (
                <div className="cook-meal" key={s.id}>
                  <Thumb recipe={s.recipe} size={46} />
                  <div className="cook-meal-txt">
                    <span className="cook-meal-label">{MEAL_LABEL[s.meal]}</span>
                    <b>{s.recipe?.title}</b>
                  </div>
                  {(s.recipe?.prep_minutes || s.recipe?.cook_minutes) && (
                    <span className="cook-meal-time">{(s.recipe.prep_minutes || 0) + (s.recipe.cook_minutes || 0)} min</span>
                  )}
                </div>
              ))}
            </div>
          </Link>

          <div className="home-cards">
            <button className="home-card" onClick={() => navigate('/shopping')}>
              <span className="hc-ic"><Icon name="cart" size={20} /></span>
              <b>Shopping list</b><span>Ready to shop</span>
            </button>
            <button className="home-card" onClick={() => navigate('/plan')}>
              <span className="hc-ic"><Icon name="calendar" size={20} /></span>
              <b>Replan</b><span>Start fresh</span>
            </button>
          </div>

          <div className="section-title">The week ahead</div>
          <div className="week-list">
            {dates.map((d) => {
              const day = filled.filter((s) => s.slot_date === d).sort((a, b) => mealOrder[a.meal] - mealOrder[b.meal])
              return (
                <Link to="/plan" className="week-row" key={d}>
                  <span className="week-day">{shortDay(d)}</span>
                  <div className="week-meals">
                    {day.slice(0, 3).map((s) => (
                      <span className="week-meal" key={s.id}><Thumb recipe={s.recipe} size={30} /><span>{s.recipe?.title}</span></span>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="cook-hero blank">
            <img className="cook-hero-mark" src="/brand/sizzler-mark-ondark.png" alt="" />
            <h2>Your week is a blank plate</h2>
            <p>Let's fill it. Swipe through recipes or build your plan by hand.</p>
            <button className="btn btn-primary" onClick={() => navigate('/plan')}>Plan my week <Icon name="arrowRight" size={18} /></button>
          </div>

          <div className="home-cards">
            <button className="home-card" onClick={() => navigate('/recipes')}>
              <span className="hc-ic"><Icon name="bookmark" size={20} /></span>
              <b>{recipes.length} recipe{recipes.length === 1 ? '' : 's'}</b><span>In your library</span>
            </button>
            <button className="home-card" onClick={() => navigate('/add')}>
              <span className="hc-ic"><Icon name="plus" size={20} /></span>
              <b>Add recipe</b><span>4 quick ways</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

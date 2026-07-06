import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, getPlanSlots, listRecipes, getShoppingList, todayISO } from '../lib/api'
import { shoppingListStale } from '../lib/shoppingList'
import { thumbUrl } from '../components/RecipeCard'
import Icon from '../components/Icon'
import { SizzleLoader } from '../components/ui/primitives'
import './pages.css'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
const weekday = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })
const shortDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })

function Thumb({ recipe, size = 44 }) {
  if (recipe?.image_url) return <img className="thumb" src={thumbUrl(recipe.image_url)} alt="" loading="lazy" decoding="async" style={{ width: size, height: size }} />
  const h = ((recipe?.title || '').length % 5)
  return <span className={`thumb thumb-fb h${h}`} style={{ width: size, height: size }}>{(recipe?.title || '?').charAt(0).toUpperCase()}</span>
}

export default function Home() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState(null)
  const [plan, setPlan] = useState(undefined)
  const [slots, setSlots] = useState([])
  const [shopComplete, setShopComplete] = useState(false)
  const [shopStale, setShopStale] = useState(false)

  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([listRecipes(), getActivePlan()])
      setRecipes(r)
      setPlan(p)
      const s = p ? await getPlanSlots(p.id) : []
      setSlots(s)
      if (p) {
        try {
          const items = await getShoppingList(p.id)
          // "Shop done" = every buyable item (not already at home) is in the cart.
          const buyable = items.filter((i) => !i.have_at_home)
          setShopComplete(buyable.length > 0 && buyable.every((i) => i.in_cart))
          // The plan changed after the list was built → it needs refreshing.
          setShopStale(shoppingListStale(s, items))
        } catch { /* no list yet */ }
      }
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
  const today = todayISO()
  const dates = [...new Set(filled.map((s) => s.slot_date))].sort()
  const heroDate = dates.find((d) => d >= today) || dates[dates.length - 1]
  const heroSlots = filled.filter((s) => s.slot_date === heroDate)
  const heroLabel = heroDate === today ? `Tonight · ${weekday(heroDate)}` : weekday(heroDate)

  // "The week ahead" shows the whole plan; days already gone are greyed out.
  const weekDates = [...new Set(slots.map((s) => s.slot_date))].sort()

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
          <div className="cook-hero">
            <div className="cook-hero-top"><span className="overline accent">{heroLabel}</span><span>{planDays}-day plan</span></div>
            <div className="cook-hero-meals">
              {heroSlots.slice(0, 3).map((s) => (
                <Link className="cook-meal" key={s.id} to={`/recipes/${s.recipe?.id}`}>
                  <Thumb recipe={s.recipe} size={46} />
                  <div className="cook-meal-txt">
                    <b>{s.recipe?.title}</b>
                  </div>
                  {(s.recipe?.prep_minutes || s.recipe?.cook_minutes) && (
                    <span className="cook-meal-time">{(s.recipe.prep_minutes || 0) + (s.recipe.cook_minutes || 0)} min</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <Link to="/plan/manual" className="plan-banner">
            <span className="pb-ic"><Icon name="calendar" size={20} /></span>
            <div className="pb-txt"><b>Your plan</b><span>Reorder & reshuffle your week</span></div>
            <Icon name="arrowRight" size={18} />
          </Link>

          <div className="home-cards">
            <button className={`home-card ${shopStale ? 'stale' : shopComplete ? 'done' : ''}`} onClick={() => navigate('/shopping')}>
              <span className="hc-ic"><Icon name={shopStale ? 'shuffle' : shopComplete ? 'check' : 'cart'} size={20} /></span>
              <b>{shopStale ? 'Update list' : shopComplete ? 'Shop done' : 'Shopping list'}</b>
              <span>{shopStale ? 'Plan changed — refresh it' : shopComplete ? 'Ingredients bought' : 'Ready to shop'}</span>
            </button>
            <button className="home-card" onClick={() => navigate('/plan')}>
              <span className="hc-ic"><Icon name="shuffle" size={20} /></span>
              <b>Replan</b><span>Start fresh</span>
            </button>
          </div>

          <div className="section-title">The week ahead</div>
          <div className="week-list">
            {weekDates.map((d) => {
              const r = slots.find((s) => s.slot_date === d && s.recipe)?.recipe
              const past = d < today
              return r ? (
                <Link to={`/recipes/${r.id}`} className={`week-row ${past ? 'past' : ''}`} key={d}>
                  <span className="week-day">{shortDay(d)}</span>
                  <div className="week-meals">
                    <span className="week-meal"><Thumb recipe={r} size={30} /><span>{r.title}</span></span>
                  </div>
                  <Icon name="arrowRight" size={16} />
                </Link>
              ) : (
                <Link to="/plan/manual" className={`week-row empty ${past ? 'past' : ''}`} key={d}>
                  <span className="week-day">{shortDay(d)}</span>
                  <div className="week-meals"><span className="week-empty">{past ? 'No dinner' : 'Nothing planned — add a dinner'}</span></div>
                  {!past && <Icon name="plus" size={16} />}
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

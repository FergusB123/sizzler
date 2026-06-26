import { Link } from 'react-router-dom'
import Icon from './Icon'
import './recipe-card.css'

export function formatTime(mins) {
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function Fallback({ recipe }) {
  const initial = (recipe.title || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="rc-fallback" data-h={(recipe.title || '').length % 5}>
      <span className="rc-fallback-initial">{initial}</span>
    </div>
  )
}

export default function RecipeCard({ recipe, to, origin }) {
  const total = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0)
  const meta = [recipe.cuisine, recipe.difficulty].filter(Boolean)
  const inner = (
    <div className="recipe-card">
      <div className="rc-media">
        {recipe.image_url ? <img src={recipe.image_url} alt={recipe.title} loading="lazy" /> : <Fallback recipe={recipe} />}
        {total > 0 && <span className="rc-time">{formatTime(total)}</span>}
        {origin === 'community' ? (
          <span className="rc-corner community"><Icon name="users" size={14} /></span>
        ) : recipe.favorite ? (
          <span className="rc-corner fav"><Icon name="heart" size={14} /></span>
        ) : recipe.is_shared ? (
          <span className="rc-corner shared"><Icon name="globe" size={14} /></span>
        ) : null}
      </div>
      <div className="rc-body">
        <h3 className="rc-title">{recipe.title}</h3>
        <div className="rc-meta">
          {meta.map((m, i) => <span key={i} className="cap">{m}</span>)}
        </div>
      </div>
    </div>
  )
  return to ? <Link to={to} className="rc-link">{inner}</Link> : inner
}

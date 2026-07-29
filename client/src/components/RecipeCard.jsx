import { Link } from 'react-router-dom'
import Icon from './Icon'
import './recipe-card.css'

// Gousto CMS images are stored at -x700 (700px). Cards render them ~180px, so
// request the smaller -x350 variant to roughly halve the bytes and load faster.
// Non-Gousto/data URLs pass through untouched.
export function thumbUrl(url, size = 350) {
  if (!url) return url
  // Our own generated images ship a -350 variant alongside the full-size file.
  if (/^\/recipe-images\/.+\.jpg$/i.test(url) && !/-350\.jpg$/i.test(url)) {
    return url.replace(/\.jpg$/i, '-350.jpg')
  }
  return url.replace(/-x700\.jpg(\?.*)?$/i, `-x${size}.jpg$1`)
}

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

export default function RecipeCard({ recipe, to, origin, selectable, selected, onToggle }) {
  const total = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0)
  const meta = [recipe.cuisine].filter(Boolean)
  const inner = (
    <div className={`recipe-card${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}`}>
      <div className="rc-media">
        {recipe.image_url ? <img src={thumbUrl(recipe.image_url)} alt={recipe.title} loading="lazy" decoding="async" /> : <Fallback recipe={recipe} />}
        {selectable && (
          <span className={`rc-check${selected ? ' on' : ''}`} aria-hidden="true">
            {selected && <Icon name="check" size={15} />}
          </span>
        )}
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
          {recipe.calories ? <span className="rc-kcal">{recipe.calories} kcal</span> : null}
        </div>
      </div>
    </div>
  )
  if (selectable) {
    return (
      <button type="button" className="rc-link rc-selectbtn" aria-pressed={!!selected} onClick={() => onToggle?.(recipe.id)}>
        {inner}
      </button>
    )
  }
  return to ? <Link to={to} className="rc-link">{inner}</Link> : inner
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRecipe, setShared, setFavorite, deleteRecipe, acceptInferredField, getActivePlan, getPlanSlots, assignSlot } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Button, IconButton, Badge, SizzleLoader, useToast, Sheet } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { formatTime } from '../components/RecipeCard'
import { useGoBack } from '../lib/useGoBack'
import { INFERRED_LABELS } from '../lib/constants'
import './recipe-detail.css'

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack('/recipes')
  const toast = useToast()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [planSheet, setPlanSheet] = useState(false)
  const [plan, setPlan] = useState(undefined)
  const [slots, setSlots] = useState([])

  useEffect(() => { getRecipe(id).then(setRecipe).catch(() => toast.error('Recipe not found')) }, [id])

  async function openPlanSheet() {
    setPlanSheet(true)
    const p = await getActivePlan()
    setPlan(p)
    if (p) setSlots(await getPlanSlots(p.id))
  }

  async function addToSlot(slot) {
    setPlanSheet(false)
    try {
      await assignSlot(slot.id, recipe.id)
      const d = new Date(slot.slot_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
      toast.success(`Added to ${d} ${MEAL_LABEL[slot.meal].toLowerCase()}`)
    } catch (e) { toast.error(e.message) }
  }

  if (!recipe) return <div className="screen"><SizzleLoader message="Plating up…" /></div>

  const isOwner = recipe.user_id === user?.id
  const inferred = new Set(recipe.ai_inferred_fields || [])
  const totalTime = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0)

  async function toggleShare() {
    const next = !recipe.is_shared
    setRecipe({ ...recipe, is_shared: next })
    try { await setShared(recipe.id, next); toast.success(next ? 'Shared to the community' : 'Made private') }
    catch (e) { toast.error(e.message); setRecipe({ ...recipe, is_shared: !next }) }
  }

  async function toggleFav() {
    const next = !recipe.favorite
    setRecipe({ ...recipe, favorite: next })
    try { await setFavorite(recipe.id, next); toast.success(next ? 'Saved to favourites' : 'Removed from favourites') }
    catch (e) { toast.error(e.message); setRecipe({ ...recipe, favorite: !next }) }
  }

  async function accept(field) {
    const next = (recipe.ai_inferred_fields || []).filter((f) => f !== field)
    setRecipe({ ...recipe, ai_inferred_fields: next })
    try { await acceptInferredField(recipe, field) } catch { /* non-critical */ }
  }

  async function doDelete() {
    try { await deleteRecipe(recipe.id); toast.show('Recipe deleted'); navigate('/recipes') }
    catch (e) { toast.error(e.message) }
  }

  const AiTag = ({ field }) => inferred.has(field)
    ? <button className="badge badge-ai" title="AI-suggested — tap to accept" onClick={() => accept(field)}>AI</button>
    : null

  return (
    <div className="rd">
      <div className="rd-hero">
        {recipe.image_url
          ? <img src={recipe.image_url} alt={recipe.title} />
          : <div className="rd-hero-fallback">{(recipe.title || '?').charAt(0).toUpperCase()}</div>}
        <div className="rd-hero-grad" />
        <div className="rd-hero-top">
          <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
          {isOwner && (
            <button className={`icon-btn rd-fav ${recipe.favorite ? 'on' : ''}`} aria-label="Favourite" onClick={toggleFav}>
              <Icon name="heart" size={20} />
            </button>
          )}
        </div>
        <div className="rd-hero-title">
          {recipe.image_is_generated && <span className="rd-genflag">✦ AI image</span>}
          <h1>{recipe.title}</h1>
          <div className="rd-hero-meta">
            {recipe.cuisine && <span>{recipe.cuisine} <AiTag field="cuisine" /></span>}
            {recipe.category && <span>· {recipe.category}</span>}
          </div>
        </div>
      </div>

      <div className="screen no-nav rd-body">
        {/* Quick facts */}
        <div className="rd-facts">
          <div className="rd-fact"><b>{formatTime(totalTime) || '—'}</b><span>Total <AiTag field="cook_minutes" /></span></div>
          <div className="rd-fact"><b className="cap">{recipe.difficulty || '—'}</b><span>Difficulty <AiTag field="difficulty" /></span></div>
          <div className="rd-fact"><b>{recipe.servings || '—'}</b><span>Serves <AiTag field="servings" /></span></div>
        </div>

        <div className="chip-row" style={{ marginBottom: 18 }}>
          {recipe.meal_types?.map((m) => <Badge key={m}>{MEAL_LABEL[m]}</Badge>)}
          {recipe.tags?.map((t) => <Badge key={t}>#{t}</Badge>)}
        </div>

        <Button variant="ghost" block className="rd-addplan" onClick={openPlanSheet}>
          <Icon name="calendar" size={18} /> Add to plan
        </Button>

        {/* Share toggle (owner only) */}
        {isOwner && (
          <button className={`rd-share ${recipe.is_shared ? 'on' : ''}`} onClick={toggleShare}>
            <span className="rd-share-ic"><Icon name="globe" size={20} /></span>
            <div>
              <b>Share to community</b>
              <span>{recipe.is_shared ? 'Other cooks can discover this' : 'Let other cooks discover it'}</span>
            </div>
            <span className={`switch ${recipe.is_shared ? 'on' : ''}`} />
          </button>
        )}

        {recipe.description && <p className="rd-desc">{recipe.description}</p>}

        {/* Ingredients */}
        <h2 className="rd-h2">Ingredients</h2>
        <ul className="rd-ingredients">
          {(recipe.ingredients || []).map((ing, i) => (
            <li key={i}>
              <span className="rd-ing-name">{ing.name || ing.raw}</span>
              <span className="rd-qty">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</span>
            </li>
          ))}
        </ul>

        {/* Method */}
        <h2 className="rd-h2">Method</h2>
        <ol className="rd-steps">
          {(recipe.steps || []).map((s, i) => (
            <li key={i}><span className="rd-step-n">{i + 1}</span><p>{s}</p></li>
          ))}
        </ol>

        {(recipe.notes || recipe.source) && (
          <div className="rd-notes">
            {recipe.source && <p><b>Source:</b> {recipe.source}</p>}
            {recipe.notes && <p>{recipe.notes}</p>}
          </div>
        )}

        {isOwner && (
          <div className="rd-owner-actions">
            <Button variant="ghost" onClick={() => navigate(`/recipes/${recipe.id}/edit`)}><Icon name="pencil" size={17} /> Edit recipe</Button>
            <Button variant="soft" onClick={() => setConfirmDel(true)}><Icon name="trash" size={17} /> Delete</Button>
          </div>
        )}
      </div>

      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Delete this recipe?">
        <p className="muted" style={{ marginBottom: 18 }}>This can't be undone.</p>
        <div className="row" style={{ gap: 12 }}>
          <Button variant="soft" onClick={() => setConfirmDel(false)} block>Cancel</Button>
          <Button variant="dark" onClick={doDelete} block>Delete</Button>
        </div>
      </Sheet>

      <Sheet open={planSheet} onClose={() => setPlanSheet(false)} title="Add to plan">
        {plan === undefined ? (
          <p className="muted">Loading your plan…</p>
        ) : !plan ? (
          <div style={{ paddingBottom: 4 }}>
            <p className="muted" style={{ marginBottom: 16 }}>You don't have an active plan yet.</p>
            <Button block onClick={() => navigate('/plan')}>Create a plan</Button>
          </div>
        ) : (
          <>
            <p className="muted" style={{ margin: '0 0 14px', fontSize: 13.5 }}>Pick a slot for <b style={{ color: 'var(--text)' }}>{recipe.title}</b>.</p>
            <div className="rd-slotpick">
              {slots.filter((s) => recipe.meal_types?.includes(s.meal)).map((s) => (
                <button key={s.id} className={`rd-slotpick-item ${s.recipe_id ? 'taken' : ''}`} onClick={() => addToSlot(s)}>
                  <span className="rsp-day">{new Date(s.slot_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</span>
                  <span className="rsp-meal">{MEAL_LABEL[s.meal]}</span>
                  <span className="rsp-state">{s.recipe ? `Replace ${s.recipe.title}` : 'Empty'}</span>
                </button>
              ))}
              {slots.filter((s) => recipe.meal_types?.includes(s.meal)).length === 0 && (
                <p className="muted">No matching meal slots in this plan.</p>
              )}
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRecipe, setFavorite, deleteRecipe, acceptInferredField, getActivePlan, getPlanSlots, assignSlot } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Button, IconButton, Badge, SizzleLoader, useToast, Sheet } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { formatTime } from '../components/RecipeCard'
import { useGoBack } from '../lib/useGoBack'
import { INFERRED_LABELS } from '../lib/constants'
import './recipe-detail.css'

const MEAL_LABEL = { dinner: 'Dinner' }
const dow = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
const dnum = (d) => new Date(d + 'T00:00:00').getDate()

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

  useEffect(() => {
    getRecipe(id).then(setRecipe).catch(() => toast.error('Recipe not found'))
    // Load the plan up front so we know whether this recipe is already in it.
    ;(async () => {
      const p = await getActivePlan()
      setPlan(p)
      if (p) setSlots(await getPlanSlots(p.id))
    })()
  }, [id])

  function openPlanSheet() { setPlanSheet(true) }

  async function addToSlot(slot) {
    setPlanSheet(false)
    try {
      await assignSlot(slot.id, recipe.id)
      setSlots((arr) => arr.map((s) => s.id === slot.id ? { ...s, recipe_id: recipe.id, recipe } : s))
      const d = new Date(slot.slot_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
      toast.success(`Added to ${d} ${MEAL_LABEL[slot.meal].toLowerCase()}`)
    } catch (e) { toast.error(e.message) }
  }

  async function removeFromPlan() {
    const targets = slots.filter((s) => String(s.recipe_id) === String(recipe.id))
    if (!targets.length) return
    try {
      await Promise.all(targets.map((s) => assignSlot(s.id, null)))
      setSlots((arr) => arr.map((s) => targets.some((t) => t.id === s.id) ? { ...s, recipe_id: null, recipe: null } : s))
      toast.success('Removed from plan')
    } catch (e) { toast.error(e.message) }
  }

  if (!recipe) return <div className="screen"><SizzleLoader message="Plating up…" /></div>

  const isOwner = recipe.user_id === user?.id
  const inferred = new Set(recipe.ai_inferred_fields || [])
  const totalTime = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0)
  const isPlanned = slots.some((s) => String(s.recipe_id) === String(recipe.id))

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
          {recipe.calories ? <div className="rd-fact"><b>{recipe.calories}</b><span>kcal / portion <AiTag field="calories" /></span></div> : null}
        </div>

        <div className="chip-row" style={{ marginBottom: 18 }}>
          {recipe.tags?.map((t) => <Badge key={t}>#{t}</Badge>)}
        </div>

        {isPlanned ? (
          <Button variant="soft" block className="rd-addplan" onClick={removeFromPlan}>
            <Icon name="x" size={18} /> Remove from plan
          </Button>
        ) : (
          <Button variant="ghost" block className="rd-addplan" onClick={openPlanSheet}>
            <Icon name="calendar" size={18} /> Add to plan
          </Button>
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

        {(recipe.notes || recipe.source || recipe.source_url) && (
          <div className="rd-notes">
            {recipe.source && <p><b>Source:</b> {recipe.source}</p>}
            {recipe.source_url && (
              <p className="rd-source-link">
                <a href={recipe.source_url} target="_blank" rel="noopener noreferrer">{recipe.source_url}</a>
              </p>
            )}
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

      <Sheet open={planSheet} onClose={() => setPlanSheet(false)} title="Add to your plan">
        {plan === undefined ? (
          <p className="muted">Loading your plan…</p>
        ) : !plan ? (
          <div style={{ paddingBottom: 4 }}>
            <p className="muted" style={{ marginBottom: 16 }}>You don't have an active plan yet.</p>
            <Button block onClick={() => navigate('/plan')}>Create a plan</Button>
          </div>
        ) : (() => {
          const daySlots = slots.filter((s) => recipe.meal_types?.includes(s.meal))
          const allFull = daySlots.length > 0 && daySlots.every((s) => s.recipe_id)
          return (
            <>
              <p className="rd-plan-note">
                {allFull
                  ? <>Your week's fully planned — pick a night to <b>swap in</b> {recipe.title}.</>
                  : <>Pick a night for <b>{recipe.title}</b>.</>}
              </p>
              <div className="rd-plan-nights">
                {daySlots.map((s) => (
                  <button key={s.id} className={`rd-plan-night ${s.recipe ? 'filled' : ''}`} onClick={() => addToSlot(s)}>
                    <span className="rd-pn-badge"><span className="rd-pn-dow">{dow(s.slot_date)}</span><span className="rd-pn-dnum">{dnum(s.slot_date)}</span></span>
                    <span className="rd-pn-body">
                      {s.recipe ? (
                        <>
                          <span className="rd-pn-cur">{s.recipe.image_url ? <img src={s.recipe.image_url} alt="" /> : null}<b>{s.recipe.title}</b></span>
                          <span className="rd-pn-act">Tap to swap</span>
                        </>
                      ) : (
                        <span className="rd-pn-empty">Free night · tap to add</span>
                      )}
                    </span>
                    <Icon name={s.recipe ? 'swap' : 'plus'} size={17} />
                  </button>
                ))}
                {daySlots.length === 0 && <p className="muted">No dinner slots in this plan.</p>}
              </div>
            </>
          )
        })()}
      </Sheet>
    </div>
  )
}

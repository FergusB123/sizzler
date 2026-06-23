import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { useProfile } from '../context/ProfileContext'
import { getActivePlan, createPlan, getPlanSlots, swipePool, assignSlots } from '../lib/api'
import { autoAllocate, targetShortlistSize } from '../lib/planner'
import { Button, SizzleLoader, EmptyState, Badge, IconButton, useToast } from '../components/ui/primitives'
import Icon from '../components/Icon'
import { formatTime } from '../components/RecipeCard'
import './swipe.css'

export default function SwipePlanner() {
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(null)
  const [slots, setSlots] = useState([])
  const [pool, setPool] = useState([])
  const [index, setIndex] = useState(0)
  const [shortlist, setShortlist] = useState([])
  const [history, setHistory] = useState([]) // {liked} per swiped card, for undo
  const [allocating, setAllocating] = useState(false)

  useEffect(() => {
    (async () => {
      let p = await getActivePlan()
      let s = p ? await getPlanSlots(p.id) : []
      // Don't silently overwrite a finished plan — start a fresh week instead.
      const fullyFilled = p && s.length > 0 && s.every((x) => x.recipe_id)
      if (!p || fullyFilled) {
        p = await createPlan({ startDate: new Date(), days: profile?.planning_horizon_days || 7, meals: profile?.planned_meals || ['breakfast', 'lunch', 'dinner'] })
        s = await getPlanSlots(p.id)
      }
      setPlan(p)
      setSlots(s)
      setPool(await swipePool(profile?.planned_meals))
      setLoading(false)
    })()
  }, [])

  const target = useMemo(() => targetShortlistSize(slots), [slots])

  async function allocate(finalShortlist) {
    setAllocating(true)
    try {
      const assignments = autoAllocate(slots, finalShortlist)
      await assignSlots(assignments)
      toast.success('Plan filled with variety')
      navigate('/plan', { replace: true })
    } catch (e) {
      toast.error(e.message)
      setAllocating(false)
    }
  }

  function decide(recipe, like) {
    const nextShortlist = like ? [...shortlist, recipe] : shortlist
    if (like) setShortlist(nextShortlist)
    setHistory((h) => [...h, { liked: like }])
    const nextIndex = index + 1
    setIndex(nextIndex)
    // Stop when we have enough, or we run out of cards.
    if (nextShortlist.length >= target || nextIndex >= pool.length) {
      if (nextShortlist.length >= 1) allocate(nextShortlist)
    }
  }

  function undo() {
    if (!history.length) return
    const last = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setIndex((i) => Math.max(0, i - 1))
    if (last.liked) setShortlist((s) => s.slice(0, -1))
  }

  if (loading) return <div className="screen no-nav"><SizzleLoader message="Gathering recipes…" /></div>
  if (allocating) return <div className="screen no-nav" style={{ minHeight: '80dvh', display: 'grid', placeContent: 'center' }}><SizzleLoader message="Allocating across your week…" /></div>

  if (pool.length === 0) {
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0 }}><IconButton onClick={() => navigate('/plan')}><Icon name="arrowLeft" size={20} /></IconButton><h1 style={{ fontSize: 22 }}>Swipe</h1></div>
        <EmptyState icon="book" title="Nothing to swipe yet" action={<Button onClick={() => navigate('/add')}>Add recipes</Button>}>
          Add a few of your own recipes, or check the community feed, then come back to swipe.
        </EmptyState>
      </div>
    )
  }

  const done = index >= pool.length || shortlist.length >= target
  const visible = pool.slice(index, index + 3).reverse() // back-to-front for stacking

  return (
    <div className="swipe-screen">
      <div className="swipe-top">
        <IconButton onClick={() => navigate('/plan')}><Icon name="arrowLeft" size={20} /></IconButton>
        <div className="swipe-progress">
          <div className="swipe-bar"><span style={{ width: `${Math.min(100, (shortlist.length / target) * 100)}%` }} /></div>
          <small>{shortlist.length} of ~{target} chosen</small>
        </div>
        <button className="swipe-undo" onClick={undo} disabled={!history.length || done} aria-label="Undo last swipe">
          <Icon name="arrowLeft" size={16} /> Undo
        </button>
      </div>

      <div className="swipe-stack">
        {done ? (
          <div className="swipe-done">
            <div className="swipe-done-ic"><Icon name="check" size={30} /></div>
            <h2>{shortlist.length} recipes shortlisted</h2>
            <Button lg onClick={() => allocate(shortlist)}>Fill my plan</Button>
          </div>
        ) : (
          <AnimatePresence>
            {visible.map((recipe, i) => {
              const isTop = i === visible.length - 1
              return (
                <SwipeCard key={recipe.id + index} recipe={recipe} isTop={isTop} depth={visible.length - 1 - i} onDecide={decide} />
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {!done && (
        <div className="swipe-actions">
          <button className="swipe-act skip" onClick={() => decide(pool[index], false)}><Icon name="x" size={24} /></button>
          <button className="swipe-act info" onClick={() => navigate(`/recipes/${pool[index].id}`)}><Icon name="info" size={20} /></button>
          <button className="swipe-act like" onClick={() => decide(pool[index], true)}><Icon name="heart" size={24} /></button>
        </div>
      )}
    </div>
  )
}

function SwipeCard({ recipe, isTop, depth, onDecide }) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-14, 14])
  const likeOp = useTransform(x, [40, 140], [0, 1])
  const nopeOp = useTransform(x, [-140, -40], [1, 0])
  const total = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0)

  return (
    <motion.div
      className="swipe-card"
      style={{ x, rotate, zIndex: 10 - depth, scale: 1 - depth * 0.04, y: depth * 12 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_e, info) => {
        if (info.offset.x > 120) onDecide(recipe, true)
        else if (info.offset.x < -120) onDecide(recipe, false)
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1 }}
      exit={{ x: x.get() > 0 ? 320 : -320, opacity: 0, transition: { duration: 0.25 } }}
    >
      <div className="sc-media">
        {recipe.image_url ? <img src={recipe.image_url} alt={recipe.title} /> : <div className="sc-fallback">{(recipe.title || '?').charAt(0).toUpperCase()}</div>}
        <div className="sc-grad" />
        <motion.div className="sc-stamp like" style={{ opacity: likeOp }}>YUM</motion.div>
        <motion.div className="sc-stamp nope" style={{ opacity: nopeOp }}>SKIP</motion.div>
        <div className="sc-origin">
          {recipe.origin === 'you' ? <Badge kind="you">Yours</Badge> : <Badge kind="community">Community</Badge>}
        </div>
        <div className="sc-info">
          <h2>{recipe.title}</h2>
          <div className="sc-meta">
            {recipe.cuisine && <span>{recipe.cuisine}</span>}
            {total > 0 && <span>{formatTime(total)}</span>}
            {recipe.difficulty && <span className="cap">{recipe.difficulty}</span>}
            {recipe.meal_types?.map((m) => <span key={m} className="sc-meal">{m}</span>)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

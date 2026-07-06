import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../../components/RecipeForm'
import { IconButton, Button, ExtractLoader, useToast } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import { formatTime } from '../../components/RecipeCard'
import { useGoBack } from '../../lib/useGoBack'
import { generateRecipeIdeas, generateRecipe, createRecipe } from '../../lib/api'
import './add.css'

const PROMPTS = [
  'Quick weeknight pasta',
  'Use up chicken & spinach',
  'Cosy autumn curry',
  'High-protein veggie dinner',
  'Something spicy with prawns',
  '15-minute noodles',
]

export default function AddAI() {
  const navigate = useNavigate()
  const goBack = useGoBack('/add')
  const toast = useToast()

  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState('input') // input | ideating | ideas | generating | review
  const [error, setError] = useState(null)
  const [ideas, setIdeas] = useState([])
  const [recipe, setRecipe] = useState(null)
  const [saving, setSaving] = useState(false)

  async function getIdeas() {
    if (!prompt.trim()) return
    setError(null)
    setPhase('ideating')
    try {
      const list = await generateRecipeIdeas(prompt.trim())
      if (!list.length) throw new Error('No ideas came back — try rephrasing.')
      setIdeas(list)
      setPhase('ideas')
    } catch (e) {
      setError(e.message || "Sizzler AI couldn't think of anything.")
      setPhase('input')
    }
  }

  async function chooseIdea(idea) {
    setError(null)
    setPhase('generating')
    try {
      const r = await generateRecipe(`${idea.title}. ${idea.blurb || ''}`.trim())
      setRecipe(r)
      setPhase('review')
    } catch (e) {
      setError(e.message || "Sizzler AI couldn't cook that one up.")
      setPhase('ideas')
    }
  }

  async function save(r) {
    setSaving(true)
    try {
      const created = await createRecipe({ ...r, source_kind: 'ai' })
      toast.success('Recipe saved')
      navigate(`/recipes/${created.id}`, { replace: true })
    } catch (e) {
      toast.error(e.message || 'Could not save')
      setSaving(false)
    }
  }

  if (phase === 'ideating') {
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0 }}><IconButton onClick={() => setPhase('input')}><Icon name="arrowLeft" size={20} /></IconButton></div>
        <ExtractLoader title="Sizzler AI is brainstorming" />
      </div>
    )
  }

  if (phase === 'generating') {
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0 }}><IconButton onClick={() => setPhase('ideas')}><Icon name="arrowLeft" size={20} /></IconButton></div>
        <ExtractLoader title="Cooking up your recipe" />
      </div>
    )
  }

  if (phase === 'review' && recipe) {
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0, marginBottom: 10 }}>
          <IconButton onClick={() => setPhase('ideas')}><Icon name="arrowLeft" size={20} /></IconButton>
          <h1 style={{ fontSize: 22 }}>Review & save</h1>
        </div>
        <div className="import-note">✦ Sizzler AI dreamt this up from your idea. Tweak anything before you save.</div>
        <RecipeForm initial={recipe} onSubmit={save} submitting={saving} sourceKind="ai" />
      </div>
    )
  }

  if (phase === 'ideas') {
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0, marginBottom: 6 }}>
          <IconButton onClick={() => setPhase('input')}><Icon name="arrowLeft" size={20} /></IconButton>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div className="overline accent">Sizzler AI</div>
          <h1 style={{ fontSize: 26, marginTop: 4, letterSpacing: '-0.03em' }}>Pick one to cook</h1>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>Tap an idea and I'll write the full recipe, with a photo.</p>
        </div>

        <div className="ai-idea-list">
          {ideas.map((idea, i) => (
            <button key={i} className="ai-idea" onClick={() => chooseIdea(idea)}>
              <div className="ai-idea-txt">
                <b>{idea.title}</b>
                <span>{idea.blurb}</span>
                <div className="ai-idea-meta">
                  {idea.cuisine && <span>{idea.cuisine}</span>}
                  {idea.time_minutes ? <span>{formatTime(idea.time_minutes)}</span> : null}
                </div>
              </div>
              <span className="ai-idea-go"><Icon name="arrowRight" size={18} /></span>
            </button>
          ))}
        </div>

        <Button variant="soft" block onClick={getIdeas} style={{ marginTop: 4 }}><Icon name="shuffle" size={16} /> More ideas</Button>
      </div>
    )
  }

  // input phase
  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 6 }}>
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
      </div>

      <div className="ai-hero">
        <span className="ai-hero-ic"><Icon name="sparkle" size={26} /></span>
        <h1>Sizzler AI</h1>
        <p>Tell me what you fancy and I'll suggest a few dinners — pick one and I'll write it up in full.</p>
      </div>

      <textarea
        className="textarea ai-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. a cosy one-pan chicken dinner for two, ready in 30 minutes"
        autoFocus
      />

      <div className="ai-ideas">
        {PROMPTS.map((s) => (
          <button key={s} className="ai-chip" onClick={() => setPrompt(s)}>{s}</button>
        ))}
      </div>

      {error && (
        <div className="import-error">
          <b>Hmm, that didn't work.</b>
          <span>{error}</span>
        </div>
      )}

      <Button block lg onClick={getIdeas} disabled={!prompt.trim()}><Icon name="sparkle" size={18} /> Get ideas</Button>
    </div>
  )
}

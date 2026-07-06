import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../../components/RecipeForm'
import { IconButton, Button, ExtractLoader, useToast } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import { useGoBack } from '../../lib/useGoBack'
import { generateRecipe, createRecipe } from '../../lib/api'
import './add.css'

const IDEAS = [
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
  const [phase, setPhase] = useState('input') // input | generating | review
  const [error, setError] = useState(null)
  const [recipe, setRecipe] = useState(null)
  const [saving, setSaving] = useState(false)

  async function run() {
    if (!prompt.trim()) return
    setError(null)
    setPhase('generating')
    try {
      const r = await generateRecipe(prompt.trim())
      setRecipe(r)
      setPhase('review')
    } catch (e) {
      setError(e.message || "Sizzler AI couldn't cook that one up.")
      setPhase('input')
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

  if (phase === 'generating') {
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0 }}><IconButton onClick={() => setPhase('input')}><Icon name="arrowLeft" size={20} /></IconButton></div>
        <ExtractLoader title="Sizzler AI is cooking" />
      </div>
    )
  }

  if (phase === 'review' && recipe) {
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0, marginBottom: 10 }}>
          <IconButton onClick={() => setPhase('input')}><Icon name="arrowLeft" size={20} /></IconButton>
          <h1 style={{ fontSize: 22 }}>Review & save</h1>
        </div>
        <div className="import-note">✦ Sizzler AI dreamt this up from your idea. Tweak anything before you save.</div>
        <RecipeForm initial={recipe} onSubmit={save} submitting={saving} sourceKind="ai" />
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
        <p>Tell me what you fancy and I'll invent a dinner — ingredients, method, the lot.</p>
      </div>

      <textarea
        className="textarea ai-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. a cosy one-pan chicken dinner for two, ready in 30 minutes"
        autoFocus
      />

      <div className="ai-ideas">
        {IDEAS.map((s) => (
          <button key={s} className="ai-chip" onClick={() => setPrompt(s)}>{s}</button>
        ))}
      </div>

      {error && (
        <div className="import-error">
          <b>Hmm, that didn't work.</b>
          <span>{error}</span>
        </div>
      )}

      <Button block lg onClick={run} disabled={!prompt.trim()}><Icon name="sparkle" size={18} /> Dream up a recipe</Button>
    </div>
  )
}

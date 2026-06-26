import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import RecipeForm from '../../components/RecipeForm'
import { IconButton, Button, ExtractLoader, useToast } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import { extractFromUrl, extractFromImage, createRecipe, uploadRecipeImage } from '../../lib/api'
import './add.css'

const COPY = {
  url: { icon: 'link', title: 'Paste a link', placeholder: 'https://…', hint: 'Works with most recipe websites.', cta: 'Import recipe' },
  social: { icon: 'film', title: 'Social video', placeholder: 'TikTok / Instagram / YouTube link', hint: 'Best-effort — some platforms block reading captions.', cta: 'Try to import' },
  photo: { icon: 'camera', title: 'Snap a photo', placeholder: '', hint: 'A cookbook page, recipe card or handwritten note.', cta: 'Read photo' },
}

const SIZZLE_BY_MODE = {
  url: 'Reading the page…',
  social: 'Peeking at the caption…',
  photo: 'Reading your photo…',
}

export default function AddImport({ mode }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const demoFail = params.get('demo') === 'fail'
  const toast = useToast()
  const copy = COPY[mode]

  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [phase, setPhase] = useState('input') // input | extracting | review
  const [error, setError] = useState(null)
  const [extracted, setExtracted] = useState(null)
  const [saving, setSaving] = useState(false)

  function pickPhoto(f) {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function runExtract() {
    setError(null)
    if (mode === 'social' && demoFail) {
      setError("We couldn't read that social link — these often block automated access. Try pasting the recipe text manually.")
      return
    }
    setPhase('extracting')
    try {
      let recipe
      if (mode === 'photo') {
        if (!file) throw new Error('Choose a photo first')
        recipe = await extractFromImage(file)
      } else {
        if (!/^https?:\/\//.test(url.trim())) throw new Error('Enter a valid link starting with http')
        recipe = await extractFromUrl(url.trim())
      }
      setExtracted(recipe)
      setPhase('review')
    } catch (e) {
      setError(e.message || "We couldn't read that.")
      setPhase('input')
    }
  }

  async function save(recipe) {
    setSaving(true)
    try {
      let image_url = recipe.image_url
      // For photo imports, keep the user's photo as the recipe image.
      if (mode === 'photo' && file && !image_url) image_url = await uploadRecipeImage(file)
      const created = await createRecipe({ ...recipe, image_url })
      toast.success('Recipe saved')
      navigate(`/recipes/${created.id}`, { replace: true })
    } catch (e) {
      toast.error(e.message || 'Could not save')
      setSaving(false)
    }
  }

  if (phase === 'extracting') {
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0 }}><IconButton onClick={() => setPhase('input')}><Icon name="arrowLeft" size={20} /></IconButton></div>
        <ExtractLoader title={mode === 'photo' ? 'Reading your photo' : mode === 'social' ? 'Reading the post' : 'Reading the page'} />
      </div>
    )
  }

  if (phase === 'review' && extracted) {
    const inferredCount = extracted.ai_inferred_fields?.length || 0
    return (
      <div className="screen no-nav">
        <div className="topbar" style={{ padding: 0, marginBottom: 10 }}>
          <IconButton onClick={() => setPhase('input')}><Icon name="arrowLeft" size={20} /></IconButton>
          <h1 style={{ fontSize: 22 }}>Review & save</h1>
        </div>
        {inferredCount > 0 && (
          <div className="import-note">
            ✦ We filled in {inferredCount} field{inferredCount === 1 ? '' : 's'} for you. Tap any <b>AI</b> tag to accept, or just edit.
          </div>
        )}
        <RecipeForm
          initial={extracted}
          onSubmit={save}
          submitting={saving}
          imagePreview={mode === 'photo' ? preview : ''}
          onPickImage={mode === 'photo' ? pickPhoto : undefined}
          sourceKind={extracted.source_kind || mode}
          sourceUrl={extracted.source_url || (mode !== 'photo' ? url : '')}
        />
      </div>
    )
  }

  // input phase
  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 8 }}>
        <IconButton onClick={() => navigate('/add')}><Icon name="arrowLeft" size={20} /></IconButton>
        <h1 style={{ fontSize: 22 }}>{copy.title}</h1>
      </div>

      <div className="import-hero"><span><Icon name={copy.icon} size={26} /></span></div>

      {mode === 'photo' ? (
        <label className="import-drop">
          {preview ? <img src={preview} alt="preview" /> : <div className="import-drop-empty"><span><Icon name="camera" size={30} /></span>Tap to choose a photo</div>}
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </label>
      ) : (
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={copy.placeholder} inputMode="url" autoCapitalize="none" autoCorrect="off" autoFocus enterKeyHint="go" onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) runExtract() }} style={{ marginBottom: 10 }} />
      )}

      <p className="muted" style={{ fontSize: 13, margin: '4px 0 18px' }}>{copy.hint}</p>

      {error && (
        <div className="import-error">
          <b>Hmm, that didn't work.</b>
          <span>{error}</span>
          <Button variant="soft" onClick={() => navigate('/add/manual')}>Enter it manually instead</Button>
        </div>
      )}

      <Button block lg onClick={runExtract} disabled={mode === 'photo' ? !file : !url.trim()}>{copy.cta}</Button>
    </div>
  )
}

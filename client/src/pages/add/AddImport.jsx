import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../../components/RecipeForm'
import { IconButton, Button, ExtractLoader, useToast } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import { useGoBack } from '../../lib/useGoBack'
import { extractFromUrl, extractFromImage, createRecipe, uploadRecipeImage } from '../../lib/api'
import './add.css'

const COPY = {
  url: { icon: 'link', title: 'Paste a link', placeholder: 'https://…', hint: 'Works with most recipe websites.', cta: 'Import recipe' },
  social: { icon: 'film', title: 'Social video', placeholder: 'TikTok / Instagram / YouTube link', hint: 'Best-effort — some platforms block reading captions.', cta: 'Try to import' },
  photo: { icon: 'camera', title: 'Snap a photo', placeholder: '', hint: 'A cookbook page, recipe card or handwritten note. Add several photos if the recipe spans multiple pages.', cta: 'Read photo' },
}

const SIZZLE_BY_MODE = {
  url: 'Reading the page…',
  social: 'Peeking at the caption…',
  photo: 'Reading your photo…',
}

export default function AddImport({ mode }) {
  const navigate = useNavigate()
  const goBack = useGoBack('/add')
  const toast = useToast()
  const copy = COPY[mode]

  const [url, setUrl] = useState('')
  const [photos, setPhotos] = useState([]) // { file, url } — supports multi-page recipes
  const [phase, setPhase] = useState('input') // input | extracting | review
  const [error, setError] = useState(null)
  const [extracted, setExtracted] = useState(null)
  const [saving, setSaving] = useState(false)

  function pickPhotos(fileList) {
    const added = [...(fileList || [])].filter(Boolean).map((f) => ({ file: f, url: URL.createObjectURL(f) }))
    if (added.length) setPhotos((p) => [...p, ...added])
  }
  function removePhoto(i) {
    setPhotos((p) => { try { URL.revokeObjectURL(p[i]?.url) } catch { /* ignore */ } return p.filter((_, j) => j !== i) })
  }
  function setCoverPhoto(f) {
    if (f) setPhotos((p) => [{ file: f, url: URL.createObjectURL(f) }, ...p.slice(1)])
  }

  async function runExtract() {
    setError(null)
    setPhase('extracting')
    try {
      let recipe
      if (mode === 'photo') {
        if (!photos.length) throw new Error('Choose a photo first')
        recipe = await extractFromImage(photos.map((p) => p.file))
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
      // For photo imports, keep the user's first photo as the recipe image.
      if (mode === 'photo' && photos[0] && !image_url) image_url = await uploadRecipeImage(photos[0].file)
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
          imagePreview={mode === 'photo' ? photos[0]?.url : ''}
          onPickImage={mode === 'photo' ? setCoverPhoto : undefined}
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
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
        <h1 style={{ fontSize: 22 }}>{copy.title}</h1>
      </div>

      <div className="import-hero"><span><Icon name={copy.icon} size={26} /></span></div>

      {mode === 'photo' ? (
        photos.length === 0 ? (
          <label className="import-drop">
            <div className="import-drop-empty"><span><Icon name="camera" size={30} /></span>Tap to choose photos</div>
            <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => pickPhotos(e.target.files)} />
          </label>
        ) : (
          <div className="import-photos">
            {photos.map((p, i) => (
              <div className="import-photo" key={i}>
                <img src={p.url} alt="" />
                <button type="button" className="import-photo-x" onClick={() => removePhoto(i)} aria-label="Remove">×</button>
                <span className="import-photo-n">{i + 1}</span>
              </div>
            ))}
            <label className="import-photo-add">
              <Icon name="plus" size={22} />
              <span>Add page</span>
              <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => pickPhotos(e.target.files)} />
            </label>
          </div>
        )
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

      <Button block lg onClick={runExtract} disabled={mode === 'photo' ? !photos.length : !url.trim()}>{photos.length > 1 ? `Read ${photos.length} photos` : copy.cta}</Button>
    </div>
  )
}

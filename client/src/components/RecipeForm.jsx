import { useState } from 'react'
import { Button, Chip, Field, Badge } from './ui/primitives'
import Icon from './Icon'
import { MEAL_OPTIONS, DIFFICULTY_OPTIONS, INFERRED_LABELS } from '../lib/constants'
import './recipe-form.css'

const blank = {
  title: '', cuisine: '', category: '', description: '',
  ingredients: [{ name: '', quantity: '', unit: '', raw: '' }],
  steps: [''],
  prep_minutes: '', cook_minutes: '', difficulty: '', servings: '',
  meal_types: ['dinner'], tags: [], notes: '', source: '',
  image_url: '', ai_inferred_fields: [],
}

// `initial` may come from AI extraction (with ai_inferred_fields populated).
// `onSubmit(recipe, imageFile)` persists. `inferred` set drives the AI tags.
export default function RecipeForm({ initial, onSubmit, submitting, imagePreview, onPickImage, sourceKind = 'manual', sourceUrl, submitLabel = 'Save recipe' }) {
  const [r, setR] = useState({ ...blank, ...initial, ingredients: initial?.ingredients?.length ? initial.ingredients : blank.ingredients, steps: initial?.steps?.length ? initial.steps : blank.steps })
  const [tagInput, setTagInput] = useState('')
  const inferred = new Set(r.ai_inferred_fields || [])

  const set = (patch) => setR((p) => ({ ...p, ...patch }))
  const clearInferred = (field) => set({ ai_inferred_fields: (r.ai_inferred_fields || []).filter((f) => f !== field) })

  const setIng = (i, patch) => set({ ingredients: r.ingredients.map((x, j) => j === i ? { ...x, ...patch } : x) })
  const addIng = () => set({ ingredients: [...r.ingredients, { name: '', quantity: '', unit: '', raw: '' }] })
  const delIng = (i) => set({ ingredients: r.ingredients.filter((_, j) => j !== i) })

  const setStep = (i, v) => set({ steps: r.steps.map((x, j) => j === i ? v : x) })
  const addStep = () => set({ steps: [...r.steps, ''] })
  const delStep = (i) => set({ steps: r.steps.filter((_, j) => j !== i) })

  const toggleMeal = (v) => set({ meal_types: r.meal_types.includes(v) ? r.meal_types.filter((x) => x !== v) : [...r.meal_types, v] })
  const addTag = () => { const t = tagInput.trim().toLowerCase(); if (t && !r.tags.includes(t)) set({ tags: [...r.tags, t] }); setTagInput('') }

  const AiTag = ({ field }) => inferred.has(field)
    ? <button type="button" className="badge badge-ai" onClick={() => clearInferred(field)} title="AI-suggested — tap to accept">{INFERRED_LABELS[field] ? 'AI' : 'AI'}</button>
    : null

  function submit(e) {
    e.preventDefault()
    const cleaned = {
      ...r,
      title: r.title.trim() || 'Untitled recipe',
      prep_minutes: r.prep_minutes ? Number(r.prep_minutes) : null,
      cook_minutes: r.cook_minutes ? Number(r.cook_minutes) : null,
      servings: r.servings ? Number(r.servings) : null,
      difficulty: r.difficulty || null,
      ingredients: r.ingredients.filter((i) => (i.name || i.raw || '').trim()).map((i) => ({ ...i, raw: i.raw || [i.quantity, i.unit, i.name].filter(Boolean).join(' ') })),
      steps: r.steps.filter((s) => s.trim()),
      meal_types: r.meal_types.length ? r.meal_types : ['dinner'],
      source_kind: sourceKind,
      source_url: sourceUrl || null,
    }
    onSubmit(cleaned)
  }

  return (
    <form onSubmit={submit} className="rf">
      {/* Image */}
      <label className="rf-image">
        {imagePreview || r.image_url
          ? <img src={imagePreview || r.image_url} alt="" />
          : <div className="rf-image-empty"><span className="rf-image-ic"><Icon name="camera" size={24} /></span>Add a photo<small>optional</small></div>}
        <input type="file" accept="image/*" hidden onChange={(e) => onPickImage?.(e.target.files?.[0])} />
        {(imagePreview || r.image_url) && <span className="rf-image-edit">Change</span>}
      </label>

      <Field label="Title"><input className="input" value={r.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Weeknight ragù" required /></Field>

      <div className="rf-2col">
        <Field label={<>Cuisine <AiTag field="cuisine" /></>}><input className="input" value={r.cuisine || ''} onChange={(e) => { set({ cuisine: e.target.value }); clearInferred('cuisine') }} placeholder="Italian" /></Field>
        <Field label={<>Category <AiTag field="category" /></>}><input className="input" value={r.category || ''} onChange={(e) => { set({ category: e.target.value }); clearInferred('category') }} placeholder="Pasta" /></Field>
      </div>

      <Field label="Description"><textarea className="textarea" value={r.description || ''} onChange={(e) => set({ description: e.target.value })} placeholder="One appetising line…" style={{ minHeight: 64 }} /></Field>

      {/* Meal types */}
      <div className="field">
        <span className="rf-label">Meal type <AiTag field="meal_types" /></span>
        <div className="chip-row">
          {MEAL_OPTIONS.map((m) => <Chip key={m.value} flame active={r.meal_types.includes(m.value)} onClick={() => { toggleMeal(m.value); clearInferred('meal_types') }}>{m.label}</Chip>)}
        </div>
      </div>

      {/* Times / difficulty / servings */}
      <div className="rf-3col">
        <Field label={<>Prep <AiTag field="prep_minutes" /></>}><input className="input" type="number" inputMode="numeric" value={r.prep_minutes || ''} onChange={(e) => { set({ prep_minutes: e.target.value }); clearInferred('prep_minutes') }} placeholder="min" /></Field>
        <Field label={<>Cook <AiTag field="cook_minutes" /></>}><input className="input" type="number" inputMode="numeric" value={r.cook_minutes || ''} onChange={(e) => { set({ cook_minutes: e.target.value }); clearInferred('cook_minutes') }} placeholder="min" /></Field>
        <Field label={<>Serves <AiTag field="servings" /></>}><input className="input" type="number" inputMode="numeric" value={r.servings || ''} onChange={(e) => { set({ servings: e.target.value }); clearInferred('servings') }} placeholder="2" /></Field>
      </div>

      <div className="field">
        <span className="rf-label">Difficulty <AiTag field="difficulty" /></span>
        <div className="chip-row">
          {DIFFICULTY_OPTIONS.map((d) => <Chip key={d.value} active={r.difficulty === d.value} onClick={() => { set({ difficulty: d.value }); clearInferred('difficulty') }}>{d.label}</Chip>)}
        </div>
      </div>

      {/* Ingredients */}
      <div className="rf-section-h">Ingredients</div>
      {r.ingredients.map((ing, i) => (
        <div className="rf-ing" key={i}>
          <input className="input rf-qty" value={ing.quantity || ''} onChange={(e) => setIng(i, { quantity: e.target.value })} placeholder="500" />
          <input className="input rf-unit" value={ing.unit || ''} onChange={(e) => setIng(i, { unit: e.target.value })} placeholder="g" />
          <input className="input" value={ing.name || ''} onChange={(e) => setIng(i, { name: e.target.value })} placeholder="ingredient" />
          <button type="button" className="rf-del" onClick={() => delIng(i)} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="rf-add" onClick={addIng}>+ Add ingredient</button>

      {/* Steps */}
      <div className="rf-section-h">Method</div>
      {r.steps.map((s, i) => (
        <div className="rf-step" key={i}>
          <span className="rf-step-n">{i + 1}</span>
          <textarea className="textarea" value={s} onChange={(e) => setStep(i, e.target.value)} placeholder="Describe this step…" style={{ minHeight: 56 }} />
          <button type="button" className="rf-del" onClick={() => delStep(i)} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="rf-add" onClick={addStep}>+ Add step</button>

      {/* Tags */}
      <div className="rf-section-h">Tags</div>
      <div className="chip-row" style={{ marginBottom: 10 }}>
        {r.tags.map((t) => <Badge key={t}><span onClick={() => set({ tags: r.tags.filter((x) => x !== t) })} style={{ cursor: 'pointer' }}>#{t} ×</span></Badge>)}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="Add a tag" />
        <Button type="button" variant="soft" onClick={addTag}>Add</Button>
      </div>

      <div className="rf-2col" style={{ marginTop: 16 }}>
        <Field label="Source"><input className="input" value={r.source || ''} onChange={(e) => set({ source: e.target.value })} placeholder="Mum's recipe" /></Field>
        <Field label="Notes"><input className="input" value={r.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Goes great with…" /></Field>
      </div>

      <Button type="submit" block lg loading={submitting} className="rf-submit">{submitLabel}</Button>
    </form>
  )
}

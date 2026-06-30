import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import RecipeForm from '../../components/RecipeForm'
import { IconButton, SizzleLoader, useToast } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import { useGoBack } from '../../lib/useGoBack'
import { getRecipe, updateRecipe, uploadRecipeImage } from '../../lib/api'

// Reuses RecipeForm to edit an existing recipe (title, ingredients, steps, image…).
export default function EditRecipe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack(`/recipes/${id}`)
  const toast = useToast()
  const [recipe, setRecipe] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { getRecipe(id).then(setRecipe).catch(() => toast.error('Recipe not found')) }, [id])

  function pickImage(f) {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function save(updated) {
    setSaving(true)
    try {
      let image_url = updated.image_url
      if (file) image_url = await uploadRecipeImage(file)
      await updateRecipe(id, {
        title: updated.title, cuisine: updated.cuisine, category: updated.category, description: updated.description,
        ingredients: updated.ingredients, steps: updated.steps, image_url,
        prep_minutes: updated.prep_minutes, cook_minutes: updated.cook_minutes, difficulty: updated.difficulty,
        servings: updated.servings, meal_types: updated.meal_types, tags: updated.tags,
        notes: updated.notes, source: updated.source, ai_inferred_fields: updated.ai_inferred_fields,
      })
      toast.success('Changes saved')
      navigate(`/recipes/${id}`, { replace: true })
    } catch (e) {
      toast.error(e.message || 'Could not save')
      setSaving(false)
    }
  }

  if (!recipe) return <div className="screen no-nav"><SizzleLoader message="Loading recipe…" /></div>

  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 14 }}>
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
        <h1 style={{ fontSize: 22 }}>Edit recipe</h1>
      </div>
      <RecipeForm initial={recipe} onSubmit={save} submitting={saving} imagePreview={preview} onPickImage={pickImage}
        sourceKind={recipe.source_kind} sourceUrl={recipe.source_url} submitLabel="Save changes" />
    </div>
  )
}

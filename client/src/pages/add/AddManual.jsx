import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../../components/RecipeForm'
import { IconButton, useToast } from '../../components/ui/primitives'
import Icon from '../../components/Icon'
import { useGoBack } from '../../lib/useGoBack'
import { createRecipe, uploadRecipeImage } from '../../lib/api'

export default function AddManual() {
  const navigate = useNavigate()
  const goBack = useGoBack('/add')
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)

  function pickImage(f) {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function save(recipe) {
    setSaving(true)
    try {
      let image_url = recipe.image_url
      if (file) image_url = await uploadRecipeImage(file)
      const created = await createRecipe({ ...recipe, image_url })
      toast.success('Recipe saved')
      navigate(`/recipes/${created.id}`, { replace: true })
    } catch (e) {
      toast.error(e.message || 'Could not save')
      setSaving(false)
    }
  }

  return (
    <div className="screen no-nav">
      <div className="topbar" style={{ padding: 0, marginBottom: 14 }}>
        <IconButton onClick={goBack}><Icon name="arrowLeft" size={20} /></IconButton>
        <h1 style={{ fontSize: 22 }}>New recipe</h1>
      </div>
      <RecipeForm onSubmit={save} submitting={saving} imagePreview={preview} onPickImage={pickImage} sourceKind="manual" />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listCommunity, createRecipe } from '../lib/api'
import RecipeCard from '../components/RecipeCard'
import { EmptyState, SizzleLoader, Sheet, Button, Badge, useToast } from '../components/ui/primitives'
import { formatTime } from '../components/RecipeCard'
import './pages.css'

export default function Community() {
  const navigate = useNavigate()
  const toast = useToast()
  const [recipes, setRecipes] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { listCommunity().then(setRecipes).catch(() => setRecipes([])) }, [])

  async function saveCopy(r) {
    setSaving(true)
    try {
      // Copy into the user's own cookbook (private by default).
      await createRecipe({
        title: r.title, cuisine: r.cuisine, category: r.category, description: r.description,
        ingredients: r.ingredients, steps: r.steps, image_url: r.image_url, image_is_generated: r.image_is_generated,
        prep_minutes: r.prep_minutes, cook_minutes: r.cook_minutes, difficulty: r.difficulty, servings: r.servings,
        meal_types: r.meal_types, tags: r.tags, source: `Community · ${r.author_name || 'a Sizzler cook'}`,
        source_kind: 'manual', is_shared: false,
      })
      toast.success('Saved to your cookbook')
      setPreview(null)
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar" style={{ padding: 0, marginBottom: 4 }}><h1>Discover</h1></div>
      <p className="muted" style={{ margin: '0 0 18px', fontSize: 14 }}>Recipes shared by the Sizzler community.</p>

      {recipes === null ? (
        <div className="recipe-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 210 }} />)}</div>
      ) : recipes.length === 0 ? (
        <EmptyState icon="globe" accent="fresh" title="Nothing shared yet">
          When people share recipes, they'll show up here. Share one of yours from its detail page to kick things off!
        </EmptyState>
      ) : (
        <div className="recipe-grid">
          {recipes.map((r) => (
            <div key={r.id} onClick={() => setPreview(r)} style={{ cursor: 'pointer' }}>
              <RecipeCard recipe={r} origin="community" />
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!preview} onClose={() => setPreview(null)} title={preview?.title}>
        {preview && (
          <>
            <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <Badge kind="community">by {preview.author_name || 'a Sizzler cook'}</Badge>
              {preview.cuisine && <Badge>{preview.cuisine}</Badge>}
              {((preview.prep_minutes || 0) + (preview.cook_minutes || 0)) > 0 && <Badge>⏱ {formatTime((preview.prep_minutes || 0) + (preview.cook_minutes || 0))}</Badge>}
            </div>
            {preview.image_url && <img src={preview.image_url} alt="" style={{ width: '100%', borderRadius: 'var(--r-lg)', marginBottom: 14, aspectRatio: '16/10', objectFit: 'cover' }} />}
            {preview.description && <p className="muted" style={{ lineHeight: 1.5, marginTop: 0 }}>{preview.description}</p>}
            <h4 style={{ margin: '14px 0 8px' }}>Ingredients</h4>
            <ul style={{ paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
              {(preview.ingredients || []).slice(0, 12).map((i, k) => <li key={k}>{[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}</li>)}
            </ul>
            <Button block lg loading={saving} onClick={() => saveCopy(preview)} style={{ marginTop: 20 }}>Save to my cookbook</Button>
          </>
        )}
      </Sheet>
    </div>
  )
}

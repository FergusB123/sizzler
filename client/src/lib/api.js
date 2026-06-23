// Data-access layer over the Express API. Keeps the same exported function names
// the pages already use, so only this file changed when we swapped Supabase for
// the Express/Neon/Cloudinary backend.
import api, { apiError } from '../api/client'

const data = async (p) => {
  try { return (await p).data } catch (e) { throw apiError(e) }
}

// ---------- profile ----------
export const getProfile = () => data(api.get('/profile'))
export const updateProfile = (patch) => data(api.put('/profile', patch))
export const completeOnboarding = (prefs) =>
  updateProfile({ ...prefs, onboarded_at: new Date().toISOString() })

// ---------- recipe images ----------
export async function uploadRecipeImage(file) {
  const form = new FormData()
  form.append('image', file)
  const res = await data(api.post('/recipes/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }))
  return res.url
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// ---------- AI extraction ----------
function normaliseExtracted(r) {
  return {
    title: r.title || 'Untitled recipe',
    cuisine: r.cuisine || null,
    category: r.category || null,
    description: r.description || null,
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    prep_minutes: r.prep_minutes ?? null,
    cook_minutes: r.cook_minutes ?? null,
    difficulty: r.difficulty || null,
    servings: r.servings ?? null,
    meal_types: r.meal_types?.length ? r.meal_types : ['dinner'],
    tags: r.tags || [],
    ai_inferred_fields: r.inferred_fields || [],
  }
}

export async function extractFromText(text) {
  const res = await data(api.post('/import/text', { text }))
  return normaliseExtracted(res.recipe)
}
export async function extractFromImage(file) {
  const form = new FormData()
  form.append('image', file)
  const res = await data(api.post('/import/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } }))
  return normaliseExtracted(res.recipe)
}
export async function extractFromUrl(url) {
  const res = await data(api.post('/import/url', { url }))
  return { ...normaliseExtracted(res.recipe), image_url: res.image_url || '', source_url: res.source_url, source_kind: res.source_kind }
}

// ---------- recipes ----------
export const listRecipes = () => data(api.get('/recipes'))
export const getRecipe = (id) => data(api.get(`/recipes/${id}`))
export const createRecipe = (recipe) => data(api.post('/recipes', recipe))
export const updateRecipe = (id, patch) => data(api.put(`/recipes/${id}`, patch))
export const deleteRecipe = (id) => data(api.delete(`/recipes/${id}`))
export const setShared = (id, isShared) => data(api.post(`/recipes/${id}/share`, { is_shared: isShared }))

export async function acceptInferredField(recipe, field) {
  const next = (recipe.ai_inferred_fields || []).filter((f) => f !== field)
  return updateRecipe(recipe.id, { ai_inferred_fields: next })
}

// ---------- community ----------
export const listCommunity = () => data(api.get('/recipes/community'))
export const swipePool = (meals) =>
  data(api.get('/recipes/swipe-pool', { params: meals?.length ? { meals: meals.join(',') } : {} }))

// ---------- meal plans ----------
export const getActivePlan = () => data(api.get('/plans/active'))
export const createPlan = ({ startDate, days, meals }) =>
  data(api.post('/plans', { startDate, days, meals }))
export const getPlanSlots = (planId) => data(api.get(`/plans/${planId}/slots`))
export const assignSlot = (slotId, recipeId) =>
  data(api.put(`/plans/slots/${slotId}`, { recipe_id: recipeId ?? null }))
export const assignSlots = (assignments) => data(api.put('/plans/slots', { assignments }))

// ---------- shopping list ----------
export const getShoppingList = (planId) => data(api.get(`/shopping/${planId}`))
export const saveShoppingList = (planId, items) => data(api.post(`/shopping/${planId}/generate`, { items }))
export const updateShoppingItem = (itemId, patch) => data(api.put(`/shopping/item/${itemId}`, patch))
export const addManualShoppingItem = (planId, name, category = 'other') =>
  data(api.post(`/shopping/${planId}/item`, { name, category }))

// ---------- util ----------
export const iso = (d) => new Date(d).toISOString().slice(0, 10)

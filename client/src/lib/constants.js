export const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { value: 'lunch', label: 'Lunch', icon: '🥪' },
  { value: 'dinner', label: 'Dinner', icon: '🍽️' },
]

export const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'dairy_free', label: 'Dairy-free' },
  { value: 'nut_allergy', label: 'Nut allergy' },
]

export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export const dietLabel = (v) => DIETARY_OPTIONS.find((d) => d.value === v)?.label || v

// Friendly labels for fields Claude may flag as inferred.
export const INFERRED_LABELS = {
  difficulty: 'Difficulty',
  cuisine: 'Cuisine',
  category: 'Category',
  meal_types: 'Meal type',
  prep_minutes: 'Prep time',
  cook_minutes: 'Cook time',
  servings: 'Servings',
  tags: 'Tags',
}

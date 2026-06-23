// Seed a demo user with a few recipes so the app has content to explore.
//   node server/seed.js   (or npm run seed)
// Demo credentials: demo@sizzler.app / sizzler1234
require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const pool = require('./database');
const { initDatabase } = require('./database');

const J = (v) => JSON.stringify(v);

const RECIPES = [
  {
    title: 'Weeknight Tomato Ragù', cuisine: 'Italian', category: 'Pasta',
    description: 'A deeply savoury slow-ish ragù that tastes like it simmered all day.',
    ingredients: [
      { name: 'beef mince', quantity: '500', unit: 'g', raw: '500g beef mince' },
      { name: 'onion', quantity: '1', unit: '', raw: '1 onion, diced' },
      { name: 'garlic', quantity: '3', unit: 'cloves', raw: '3 cloves garlic' },
      { name: 'chopped tomatoes', quantity: '2', unit: 'tins', raw: '2 tins chopped tomatoes' },
      { name: 'tagliatelle', quantity: '400', unit: 'g', raw: '400g tagliatelle' },
    ],
    steps: ['Brown the mince in a hot pan.', 'Add onion and garlic, soften.', 'Pour in tomatoes, simmer 30 min.', 'Toss through cooked tagliatelle.'],
    prep_minutes: 10, cook_minutes: 40, difficulty: 'easy', servings: 4,
    meal_types: ['dinner'], tags: ['comfort', 'batch'], is_shared: true,
  },
  {
    title: 'Green Shakshuka', cuisine: 'Middle Eastern', category: 'Eggs',
    description: 'Eggs baked in a vibrant green pepper and spinach sauce.',
    ingredients: [
      { name: 'eggs', quantity: '4', unit: '', raw: '4 eggs' },
      { name: 'spinach', quantity: '200', unit: 'g', raw: '200g spinach' },
      { name: 'green pepper', quantity: '2', unit: '', raw: '2 green peppers' },
      { name: 'cumin', quantity: '1', unit: 'tsp', raw: '1 tsp cumin' },
    ],
    steps: ['Soften peppers with cumin.', 'Wilt in spinach.', 'Make wells, crack in eggs.', 'Cover and cook until set.'],
    prep_minutes: 8, cook_minutes: 15, difficulty: 'easy', servings: 2,
    meal_types: ['breakfast', 'lunch'], tags: ['vegetarian', 'quick'], is_shared: true,
  },
  {
    title: 'Thai Green Curry', cuisine: 'Thai', category: 'Curry',
    description: 'Fragrant, creamy and ready faster than a takeaway.',
    ingredients: [
      { name: 'chicken thighs', quantity: '500', unit: 'g', raw: '500g chicken thighs' },
      { name: 'green curry paste', quantity: '3', unit: 'tbsp', raw: '3 tbsp green curry paste' },
      { name: 'coconut milk', quantity: '1', unit: 'tin', raw: '1 tin coconut milk' },
      { name: 'jasmine rice', quantity: '300', unit: 'g', raw: '300g jasmine rice' },
    ],
    steps: ['Fry the curry paste.', 'Add chicken, brown.', 'Pour in coconut milk, simmer.', 'Serve over rice.'],
    prep_minutes: 10, cook_minutes: 25, difficulty: 'medium', servings: 4,
    meal_types: ['dinner'], tags: ['spicy'], is_shared: false,
  },
  {
    title: 'Overnight Oats with Berries', cuisine: 'British', category: 'Breakfast',
    description: 'Five minutes tonight, breakfast sorted tomorrow.',
    ingredients: [
      { name: 'rolled oats', quantity: '80', unit: 'g', raw: '80g rolled oats' },
      { name: 'milk', quantity: '200', unit: 'ml', raw: '200ml milk' },
      { name: 'mixed berries', quantity: '100', unit: 'g', raw: '100g mixed berries' },
      { name: 'honey', quantity: '1', unit: 'tbsp', raw: '1 tbsp honey' },
    ],
    steps: ['Combine oats and milk in a jar.', 'Stir in honey.', 'Chill overnight.', 'Top with berries.'],
    prep_minutes: 5, cook_minutes: 0, difficulty: 'easy', servings: 1,
    meal_types: ['breakfast'], tags: ['vegetarian', 'make-ahead'], is_shared: true,
  },
];

async function run() {
  await initDatabase();
  const email = 'demo@sizzler.app';
  const hash = await bcrypt.hash('sizzler1234', 12);

  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash, household_kind, household_size, planned_meals, planning_horizon_days, dietary_prefs, onboarded_at)
     VALUES ($1,'Demo Cook',$2,'couple',2,$3,7,$4,NOW()) RETURNING id`,
    [email, hash, J(['breakfast', 'lunch', 'dinner']), J([])]
  );
  const userId = rows[0].id;

  for (const r of RECIPES) {
    await pool.query(
      `INSERT INTO recipes (user_id, title, cuisine, category, description, ingredients, steps,
        prep_minutes, cook_minutes, difficulty, servings, meal_types, tags, is_shared, shared_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, CASE WHEN $14 THEN NOW() ELSE NULL END)`,
      [userId, r.title, r.cuisine, r.category, r.description, J(r.ingredients), J(r.steps),
       r.prep_minutes, r.cook_minutes, r.difficulty, r.servings, J(r.meal_types), J(r.tags), r.is_shared]
    );
  }

  console.log(`Seeded ${RECIPES.length} recipes for ${email} (password: sizzler1234)`);
  await pool.end();
}

run().catch((e) => { console.error(e); process.exit(1); });

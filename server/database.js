const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. See .env.example');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Profile preferences live on the users row (mirrors Botanica storing
// push_subscription on users). Arrays are JSONB so pg hands them back as JS arrays.
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      household_kind TEXT DEFAULT 'couple',
      household_size INTEGER DEFAULT 2,
      planned_meals JSONB DEFAULT '["breakfast","lunch","dinner"]',
      planning_horizon_days INTEGER DEFAULT 7,
      dietary_prefs JSONB DEFAULT '[]',
      onboarded_at TIMESTAMPTZ,
      push_subscription TEXT,
      push_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      cuisine TEXT,
      category TEXT,
      description TEXT,
      ingredients JSONB DEFAULT '[]',
      steps JSONB DEFAULT '[]',
      image_url TEXT,
      image_is_generated BOOLEAN DEFAULT FALSE,
      prep_minutes INTEGER,
      cook_minutes INTEGER,
      difficulty TEXT,
      servings INTEGER,
      meal_types JSONB DEFAULT '["dinner"]',
      tags JSONB DEFAULT '[]',
      notes TEXT,
      source TEXT,
      source_kind TEXT DEFAULT 'manual',
      source_url TEXT,
      ai_inferred_fields JSONB DEFAULT '[]',
      is_shared BOOLEAN DEFAULT FALSE,
      shared_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS recipes_user_idx ON recipes(user_id);
    CREATE INDEX IF NOT EXISTS recipes_shared_idx ON recipes(is_shared) WHERE is_shared = TRUE;

    CREATE TABLE IF NOT EXISTS meal_plans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      meals JSONB DEFAULT '["breakfast","lunch","dinner"]',
      status TEXT DEFAULT 'active',
      reminded_2d_at TIMESTAMPTZ,
      reminded_1d_at TIMESTAMPTZ,
      reminded_0d_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS meal_plans_user_idx ON meal_plans(user_id, status);

    CREATE TABLE IF NOT EXISTS plan_slots (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_date DATE NOT NULL,
      meal TEXT NOT NULL,
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (plan_id, slot_date, meal)
    );
    CREATE INDEX IF NOT EXISTS plan_slots_plan_idx ON plan_slots(plan_id);

    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity TEXT,
      category TEXT DEFAULT 'other',
      from_recipes JSONB DEFAULT '[]',
      have_at_home BOOLEAN DEFAULT FALSE,
      in_cart BOOLEAN DEFAULT FALSE,
      manual BOOLEAN DEFAULT FALSE,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS shopping_items_plan_idx ON shopping_list_items(plan_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER,
      type TEXT,
      message TEXT,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
  `);
  console.log('Database schema ready.');
}

module.exports = pool;
module.exports.initDatabase = initDatabase;

-- Migration: Remy weekly meal-prep tables — library recipes, Mon–Sun weeks,
-- breakfast/lunch/dinner placements, and the aggregated weekly shopping list.
-- Recipes persist the same extended gen-UI recipe-card body as mise_recipes
-- (plus glance fields). Event mise is unchanged; do not auto-import mise_recipes.
--
-- After applying, regenerate types (needs a linked Supabase CLI project):
--   bun run supabase:types
-- Until then, data/supabase/prep.ts maps rows → Zod the same way mise.ts does
-- (mise_* is also absent from lib/supabase/types.ts today).

-- =====================================================================================
-- prep_recipes (durable library; one card body, reusable across weeks)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS prep_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  -- Stable id the LLM/store uses; unique per owner so upserts can match on it.
  client_key TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  servings TEXT,
  prep_time TEXT,
  cook_time TEXT,
  duration TEXT,
  complexity TEXT CHECK (complexity IS NULL OR complexity IN ('easy', 'medium', 'hard')),
  main_protein TEXT,
  main_carbs TEXT,
  cuisine TEXT,
  equipment TEXT[],
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, client_key)
);

CREATE INDEX IF NOT EXISTS idx_prep_recipes_owner_id ON prep_recipes(owner_id);

-- =====================================================================================
-- prep_weeks (one row per owner per Monday)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS prep_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  -- ISO date of the Monday that starts this week.
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, week_start),
  CONSTRAINT prep_weeks_week_start_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1)
);

CREATE INDEX IF NOT EXISTS idx_prep_weeks_owner_id ON prep_weeks(owner_id);

-- =====================================================================================
-- prep_placements (one recipe — or leftover-of another slot — per week/date/slot)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS prep_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES prep_weeks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
  recipe_id UUID NOT NULL REFERENCES prep_recipes(id) ON DELETE RESTRICT,
  -- When set, this slot is leftover of a cook placement; shopping ignores it.
  leftover_of_placement_id UUID REFERENCES prep_placements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_id, date, slot)
);

CREATE INDEX IF NOT EXISTS idx_prep_placements_week_id ON prep_placements(week_id);
CREATE INDEX IF NOT EXISTS idx_prep_placements_owner_id ON prep_placements(owner_id);
CREATE INDEX IF NOT EXISTS idx_prep_placements_recipe_id ON prep_placements(recipe_id);
CREATE INDEX IF NOT EXISTS idx_prep_placements_leftover_of ON prep_placements(leftover_of_placement_id);

-- =====================================================================================
-- prep_week_ingredients (aggregated shopping; identity keeps checkoffs across recomputes)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS prep_week_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES prep_weeks(id) ON DELETE CASCADE,
  -- Normalized name+unit key; stable across re-aggregation for this week.
  identity TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'need' CHECK (status IN ('have', 'need')),
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_id, identity)
);

CREATE INDEX IF NOT EXISTS idx_prep_week_ingredients_week_id ON prep_week_ingredients(week_id);
CREATE INDEX IF NOT EXISTS idx_prep_week_ingredients_owner_id ON prep_week_ingredients(owner_id);

-- =====================================================================================
-- Row Level Security
-- =====================================================================================
ALTER TABLE prep_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_week_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own prep_recipes"
  ON prep_recipes FOR ALL
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users manage their own prep_weeks"
  ON prep_weeks FOR ALL
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users manage their own prep_placements"
  ON prep_placements FOR ALL
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users manage their own prep_week_ingredients"
  ON prep_week_ingredients FOR ALL
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

-- =====================================================================================
-- updated_at triggers
-- =====================================================================================
CREATE OR REPLACE FUNCTION update_prep_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prep_recipes_updated_at
  BEFORE UPDATE ON prep_recipes
  FOR EACH ROW EXECUTE FUNCTION update_prep_updated_at();

CREATE TRIGGER update_prep_weeks_updated_at
  BEFORE UPDATE ON prep_weeks
  FOR EACH ROW EXECUTE FUNCTION update_prep_updated_at();

CREATE TRIGGER update_prep_placements_updated_at
  BEFORE UPDATE ON prep_placements
  FOR EACH ROW EXECUTE FUNCTION update_prep_updated_at();

CREATE TRIGGER update_prep_week_ingredients_updated_at
  BEFORE UPDATE ON prep_week_ingredients
  FOR EACH ROW EXECUTE FUNCTION update_prep_updated_at();

COMMENT ON TABLE prep_recipes IS 'Reusable Remy library recipes; same extended recipe-card body as mise_recipes';
COMMENT ON TABLE prep_weeks IS 'One meal-prep week per owner, keyed by Monday week_start';
COMMENT ON TABLE prep_placements IS 'Breakfast/lunch/dinner slot pointing at a library recipe or leftover-of another slot';
COMMENT ON TABLE prep_week_ingredients IS 'Aggregated weekly shopping list; identity preserves have/need/checked across recomputes';

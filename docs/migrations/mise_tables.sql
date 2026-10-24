-- Migration: Remy meal-planning ("mise") tables — events, recipes, and the ingredient tracker.
-- The planner persists one event per planning thread, with grouped recipe cards and a
-- have/need shopping list. Recipes/ingredients carry a client-supplied `client_key` (the id
-- the LLM/store uses) so the client store can reconcile streamed commands with persisted rows.

-- =====================================================================================
-- mise_events
-- =====================================================================================
CREATE TABLE IF NOT EXISTS mise_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  -- One event per planning thread. NULL allowed for events not tied to a chat thread.
  thread_id TEXT UNIQUE,
  title TEXT NOT NULL,
  event_date DATE,
  event_time TEXT,
  location TEXT,
  guest_count INT,
  notes TEXT,
  -- The prep schedule: an array of gen-UI plan-timeline steps.
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mise_events_owner_id ON mise_events(owner_id);

-- =====================================================================================
-- mise_recipes
-- =====================================================================================
CREATE TABLE IF NOT EXISTS mise_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES mise_events(id) ON DELETE CASCADE,
  -- Stable id the LLM/store uses; unique within an event so upserts can match on it.
  client_key TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  servings TEXT,
  prep_time TEXT,
  cook_time TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, client_key)
);

CREATE INDEX IF NOT EXISTS idx_mise_recipes_event_id ON mise_recipes(event_id);
CREATE INDEX IF NOT EXISTS idx_mise_recipes_owner_id ON mise_recipes(owner_id);

-- =====================================================================================
-- mise_ingredients (the have/need tracker)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS mise_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES mise_events(id) ON DELETE CASCADE,
  client_key TEXT NOT NULL,
  -- Optional link to the recipe this ingredient is for (client_key of a mise_recipes row).
  recipe_key TEXT,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'need' CHECK (status IN ('have', 'need')),
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, client_key)
);

CREATE INDEX IF NOT EXISTS idx_mise_ingredients_event_id ON mise_ingredients(event_id);
CREATE INDEX IF NOT EXISTS idx_mise_ingredients_owner_id ON mise_ingredients(owner_id);

-- =====================================================================================
-- Row Level Security
-- =====================================================================================
ALTER TABLE mise_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mise_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mise_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own mise_events"
  ON mise_events FOR ALL
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users manage their own mise_recipes"
  ON mise_recipes FOR ALL
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users manage their own mise_ingredients"
  ON mise_ingredients FOR ALL
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

-- =====================================================================================
-- updated_at triggers
-- =====================================================================================
CREATE OR REPLACE FUNCTION update_mise_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mise_events_updated_at
  BEFORE UPDATE ON mise_events
  FOR EACH ROW EXECUTE FUNCTION update_mise_updated_at();

CREATE TRIGGER update_mise_recipes_updated_at
  BEFORE UPDATE ON mise_recipes
  FOR EACH ROW EXECUTE FUNCTION update_mise_updated_at();

CREATE TRIGGER update_mise_ingredients_updated_at
  BEFORE UPDATE ON mise_ingredients
  FOR EACH ROW EXECUTE FUNCTION update_mise_updated_at();

COMMENT ON TABLE mise_events IS 'Remy meal-planning events (one per planning thread) with a persisted prep timeline';
COMMENT ON TABLE mise_recipes IS 'Recipe cards grouped under a mise_events row';
COMMENT ON TABLE mise_ingredients IS 'Have/need ingredient + shopping tracker for a mise_events row';

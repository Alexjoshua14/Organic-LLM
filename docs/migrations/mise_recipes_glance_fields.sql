-- Optional glance/library fields on event mise_recipes so those cards can carry
-- the same extended recipe-card body. Nullable; existing rows stay valid.
-- Do not copy mise_recipes into prep_recipes.

ALTER TABLE mise_recipes ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE mise_recipes
  ADD COLUMN IF NOT EXISTS complexity TEXT;
ALTER TABLE mise_recipes ADD COLUMN IF NOT EXISTS main_protein TEXT;
ALTER TABLE mise_recipes ADD COLUMN IF NOT EXISTS main_carbs TEXT;
ALTER TABLE mise_recipes ADD COLUMN IF NOT EXISTS cuisine TEXT;
ALTER TABLE mise_recipes ADD COLUMN IF NOT EXISTS equipment TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mise_recipes_complexity_check'
  ) THEN
    ALTER TABLE mise_recipes
      ADD CONSTRAINT mise_recipes_complexity_check
      CHECK (complexity IS NULL OR complexity IN ('easy', 'medium', 'hard'));
  END IF;
END $$;

COMMENT ON COLUMN mise_recipes.duration IS 'Optional total-time glance field (recipe-card body)';
COMMENT ON COLUMN mise_recipes.complexity IS 'Optional easy|medium|hard glance field';
COMMENT ON COLUMN mise_recipes.main_protein IS 'Optional main protein glance field';
COMMENT ON COLUMN mise_recipes.main_carbs IS 'Optional main carbs glance field';
COMMENT ON COLUMN mise_recipes.cuisine IS 'Optional cuisine glance field';
COMMENT ON COLUMN mise_recipes.equipment IS 'Optional equipment list (recipe-card body)';

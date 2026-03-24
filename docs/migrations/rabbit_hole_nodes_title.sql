-- Persist model-generated article title per node (browse/path use segment labels; article UI uses this after reload).
ALTER TABLE rabbit_hole_nodes
  ADD COLUMN IF NOT EXISTS title TEXT;

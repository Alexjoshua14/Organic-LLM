-- Add preview column to rabbit_hole_nodes for persisting quick preview text
ALTER TABLE rabbit_hole_nodes
  ADD COLUMN IF NOT EXISTS preview TEXT NULL;


-- Relax key_takeaways length constraint on rabbit_hole_nodes to allow 0-6 items.
-- Previously: CHECK (array_length(key_takeaways, 1) >= 3 AND array_length(key_takeaways, 1) <= 6)

ALTER TABLE rabbit_hole_nodes
  DROP CONSTRAINT IF EXISTS rabbit_hole_nodes_key_takeaways_check;

ALTER TABLE rabbit_hole_nodes
  ADD CONSTRAINT rabbit_hole_nodes_key_takeaways_len_check
  CHECK (array_length(key_takeaways, 1) <= 6);


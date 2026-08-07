-- Token-efficient article node summary for graph context retrieval and cost estimation.
ALTER TABLE rabbit_hole_nodes
  ADD COLUMN IF NOT EXISTS summary TEXT NULL;

COMMENT ON COLUMN rabbit_hole_nodes.summary IS
  'Dense overview of article content (takeaways, sources, body) for graph context; capped at generation time (~2000 output tokens).';

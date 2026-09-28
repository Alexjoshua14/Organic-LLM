/**
 * bun run scripts/backfill-memory-reference-count.ts [--apply]
 * Defaults to count-only. Targets the same collection/endpoint as the app.
 * Adds only a missing reference_count; no memory text, vectors, or existing counts change.
 */
import { getMemoryQdrantClient } from "../config/memory-qdrant-client";

import { MEMORY_PRODUCTION_QDRANT_COLLECTION } from "../config/memory-production-meta";

if (!process.env.MEMORY_API_HOST) throw new Error("MEMORY_API_HOST is required");
const client = getMemoryQdrantClient();
const filter = { must: [{ is_empty: { key: "reference_count" } }] };
const { count } = await client.count(MEMORY_PRODUCTION_QDRANT_COLLECTION, { filter, exact: true });

// eslint-disable-next-line no-console -- Operator script; counts only.
console.info(`${count} memory records have no reference_count.`);
if (process.argv.includes("--apply")) {
  await client.setPayload(MEMORY_PRODUCTION_QDRANT_COLLECTION, {
    payload: { reference_count: 0 },
    filter,
    wait: true,
  });
  // eslint-disable-next-line no-console -- Operator script; no content.
  console.info("Missing reference_count fields initialized to zero.");
}

/**
 * Legacy Qdrant `memories` collection (pre–memories_v2 cutover).
 *
 * **Sandbox / migration only** — import from here only in:
 * - `app/sandbox/migration-tests/`
 * - `app/api/sandbox/memory-migration-test/`
 * - `scripts/migrate-memories-v2.ts`
 *
 * Live Mem0 + chat retrieval use `config/memory-production-meta.ts` (`memories_v2`).
 */
export const MEMORY_LEGACY_QDRANT_COLLECTION = "memories";
export const MEMORY_LEGACY_EMBEDDER_MODEL = "all-minilm";
export const MEMORY_LEGACY_EMBEDDING_DIMS = 384;

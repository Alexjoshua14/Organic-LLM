/**
 * Shared Qdrant client factory (Next server and Bun CLI scripts). Not marked
 * `server-only` so scripts like `migrate-memories-v2.ts` can import it;
 * app entry points (`mem0-config`, `lib/memory/*`) enforce server boundaries.
 */
import { QdrantClient } from "@qdrant/js-client-rest";

const MEMORY_HOST = process.env.MEMORY_API_HOST ?? "localhost";
const MEMORY_PORT = MEMORY_HOST === "localhost" ? 6333 : 443;
const MEMORY_KEY = process.env.MEMORY_API_SECRET;

let client: QdrantClient | null = null;

export function getMemoryQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      host: MEMORY_HOST,
      port: MEMORY_PORT,
      https: true,
      apiKey: MEMORY_KEY,
    });
  }

  return client;
}

import "server-only";

import { GatewayProviderOptions } from "@ai-sdk/gateway";
import { generateText } from "ai";

import { recordLlmCall } from "@/lib/llm/metrics";
import type { MemoryMigrationTestRun } from "@/lib/memory/memory-migration-test-types";

const MAX_BLOB_CHARS = 14_000;

/** Gateway model; override with MEMORY_MIGRATION_SYNOPSIS_MODEL (e.g. openai/gpt-5-mini). */
const synopsisModelEnv = process.env.MEMORY_MIGRATION_SYNOPSIS_MODEL?.trim();
export const MEMORY_MIGRATION_SYNOPSIS_MODEL =
  synopsisModelEnv && synopsisModelEnv.length > 0 ? synopsisModelEnv : "openai/gpt-5-nano";

const SYSTEM = `You summarize results of a technical A/B comparison between two memory retrieval backends (legacy "memories" vs candidate "memories_v2") for the same user queries.

Rules:
- Two short paragraphs maximum, plain prose, no markdown headings.
- Be precise: only describe patterns visible in the supplied data (merged vs split rows, v2 errors, marginal score notes if present). Do not invent counts or causes.
- Call out likely issues (e.g. many legacy-only rows, many v2-only rows, systematic v2 failures, frequent text mismatch on same id).
- If the data is thin or mostly padding queries, say so briefly.`;

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[truncated]`;
}

export function serializeMigrationRunsForSynopsis(runs: MemoryMigrationTestRun[]): string {
  const parts: string[] = [];
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]!;
    parts.push(`\n--- Run ${i + 1} ---`);
    parts.push(`query: ${clip(r.query, 500)}`);
    if (r.v2Error) parts.push(`v2_error: ${r.v2Error}`);
    let merged = 0;
    let split = 0;
    for (const row of r.rows) {
      if (row.kind === "merged") merged++;
      else split++;
    }
    parts.push(`row_counts: merged=${merged} split=${split} total_rows=${r.rows.length}`);
    for (let j = 0; j < r.rows.length; j++) {
      const row = r.rows[j]!;
      if (row.kind === "merged") {
        parts.push(
          `row ${j}: merged id=${row.memory.id.slice(0, 12)}… text=${clip(row.memory.memory, 160)}`
        );
      } else {
        const l = row.legacy;
        const v = row.v2;
        const marg: string[] = [];
        if ("v2Marginal" in row && row.v2Marginal) {
          marg.push(
            `v2Marginal bestChunk=${row.v2Marginal.bestChunkScore.toFixed(4)} lowestRet=${row.v2Marginal.lowestReturnedV2Score?.toFixed(4) ?? "n/a"} delta=${row.v2Marginal.deltaVsLowestReturned?.toFixed(4) ?? "n/a"}`
          );
        }
        if ("legacyMarginal" in row && row.legacyMarginal) {
          marg.push(
            `legacyMarginal bestLegacy=${row.legacyMarginal.bestLegacyScore.toFixed(4)} lowestRet=${row.legacyMarginal.lowestReturnedLegacyScore?.toFixed(4) ?? "n/a"} delta=${row.legacyMarginal.deltaVsLowestReturned?.toFixed(4) ?? "n/a"}`
          );
        }
        parts.push(
          `row ${j}: split legacy=${l ? `id=${l.id.slice(0, 12)}… ${clip(l.memory, 120)}` : "—"} | v2=${v ? `id=${v.id.slice(0, 12)}… ${clip(v.memory, 120)}` : "—"}${marg.length ? ` | ${marg.join(" | ")}` : ""}`
        );
      }
    }
  }
  const blob = parts.join("\n");
  return clip(blob, MAX_BLOB_CHARS);
}

export async function generateMigrationTestSynopsis(
  runs: MemoryMigrationTestRun[]
): Promise<string> {
  const blob = serializeMigrationRunsForSynopsis(runs);
  const start = performance.now();
  const result = await generateText({
    model: MEMORY_MIGRATION_SYNOPSIS_MODEL,
    system: SYSTEM,
    prompt: `Comparison run data:\n${blob}`,
    maxOutputTokens: 400,
    temperature: 0.2,
    providerOptions: {
      gateway: {
        zeroDataRetention: true,
      } satisfies GatewayProviderOptions,
    },
  });
  const durationMs = performance.now() - start;

  recordLlmCall({
    model: MEMORY_MIGRATION_SYNOPSIS_MODEL,
    usage: result.usage,
    durationMs,
    metadata: {
      operation: "memory-migration-test-synopsis",
      route: "/api/sandbox/memory-migration-test",
    },
  });

  return result.text.trim();
}

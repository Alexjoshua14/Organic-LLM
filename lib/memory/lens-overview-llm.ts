import "server-only";

import { GatewayProviderOptions } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { unstable_cache } from "next/cache";

import { LENS_OVERVIEW_MODEL } from "@/lib/memory/lens-overview-input";
import { recordLlmCall } from "@/lib/llm/metrics";

const SYSTEM = `You write a brief overview of a set of user memory snippets shown on one page of a settings UI.
Rules:
- Plain prose only, no bullet lists unless essential (prefer one short paragraph).
- At most 120 words.
- Describe themes and kinds of information stored; do not invent facts beyond the snippets.
- If snippets are sparse or unrelated, say so neutrally.`;

/**
 * Cached LLM overview for identical (user, memory-page text) inputs. Revalidates on a TTL so
 * updated memory text eventually refreshes without manual purge.
 */
export const generateLensOverviewTextCached = unstable_cache(
  async (sbUserId: string, userBlob: string) => {
    const start = performance.now();
    const result = await generateText({
      model: LENS_OVERVIEW_MODEL,
      system: SYSTEM,
      prompt: `Memory snippets on this page:\n${userBlob}`,
      maxOutputTokens: 320,
      temperature: 0.3,
      providerOptions: {
        gateway: {
          zeroDataRetention: true,
        } satisfies GatewayProviderOptions,
      },
    });
    const durationMs = performance.now() - start;

    recordLlmCall({
      model: LENS_OVERVIEW_MODEL,
      usage: result.usage,
      durationMs,
      metadata: { operation: "memory-lens-overview", route: "/api/memory/lens-overview" },
    });

    return result.text.trim();
  },
  ["memory-lens-overview-llm"],
  { revalidate: 1800 }
);

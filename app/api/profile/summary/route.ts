import type { MemoryItemType } from "@/lib/schemas/memory";
import type { GatewayProviderOptions } from "@ai-sdk/gateway";

import { auth } from "@clerk/nextjs/server";
import { generateObject, generateText, stepCountIs, tool } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId, upsertProfileTreeForCurrentUser } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { searchMemoriesForUser } from "@/lib/memory/operations";
import { checkProfileTreeGenerationLimit } from "@/lib/rate-limit/profile";
import { SearchMemoryToolSchema } from "@/lib/schemas/llm-tools";
import { ProfileTreeSchema } from "@/lib/schemas/profileTree";

const logger = createLogger("app/api/profile/summary/route.ts");
const PROFILE_GENERATION_MODEL = "anthropic/claude-opus-4.7";
const BASELINE_MEMORY_SEARCH_LIMIT = 50;
const BASELINE_MEMORY_PROMPT_LIMIT = 30;
const BASELINE_MEMORY_MIN_SCORE = 0.45;
const BASELINE_MEMORY_MIN_FALLBACK = 8;
const PROFILE_GENERATION_PROVIDER_OPTIONS = {
  gateway: {
    zeroDataRetention: true,
  } satisfies GatewayProviderOptions,
};

const RequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  email: z.email().optional().or(z.literal("")),
});

const SYSTEM = `You generate concise, production-ready profile content as a tiered ProfileTree. Output valid JSON only. Never return an empty object. The object must include a non-empty headline string and a non-empty sections array. No emoji. Keep the tone specific, polished, and neutral. Use 3-5 sections, short titles, concise body copy, and compact item lists.`;

function selectProfileMemories(memories: MemoryItemType[]): MemoryItemType[] {
  const scoredMemories = memories.filter((memory) => typeof memory.score === "number");

  if (!scoredMemories.length) {
    return memories.slice(0, BASELINE_MEMORY_PROMPT_LIMIT);
  }

  const highConfidenceMemories = scoredMemories.filter(
    (memory) => memory.score! >= BASELINE_MEMORY_MIN_SCORE
  );

  if (highConfidenceMemories.length) {
    return highConfidenceMemories.slice(0, BASELINE_MEMORY_PROMPT_LIMIT);
  }

  return scoredMemories.slice(0, BASELINE_MEMORY_MIN_FALLBACK);
}

function formatMemoriesForPrompt(memories: MemoryItemType[]): string {
  if (!memories.length) return "No relevant stored memories found.";

  return memories
    .slice(0, BASELINE_MEMORY_PROMPT_LIMIT)
    .map((memory, index) => {
      const score = typeof memory.score === "number" ? ` score=${memory.score.toFixed(3)}` : "";

      return `${index + 1}. ${memory.memory}${score}`;
    })
    .join("\n");
}

async function getBaselineMemoryContext(userId: string): Promise<string> {
  const result = await searchMemoriesForUser(
    userId,
    "profile biography identity work projects skills interests preferences goals personal context",
    { limit: BASELINE_MEMORY_SEARCH_LIMIT }
  );

  if (result.error || !result.data?.results?.length) return "No relevant stored memories found.";

  return formatMemoriesForPrompt(selectProfileMemories(result.data.results));
}

function createProfileMemorySearchTool(userId: string) {
  return tool({
    description:
      "Search the signed-in user's stored memories for profile-relevant facts, preferences, projects, goals, interests, and context.",
    inputSchema: SearchMemoryToolSchema,
    execute: async ({ query, limit }) => {
      const result = await searchMemoriesForUser(userId, query, { limit });

      if (result.error || !result.data) {
        return {
          success: false,
          query,
          error: result.error ?? "Memory search failed",
          memories: [],
          count: 0,
        };
      }

      return {
        success: true,
        query,
        memories: result.data.results,
        count: result.data.results.length,
      };
    },
  });
}

async function gatherMemoryContext({
  userId,
  displayName,
  emailDomain,
  baselineMemories,
}: {
  userId: string;
  displayName: string;
  emailDomain: string;
  baselineMemories: string;
}): Promise<string> {
  const start = performance.now();
  const { text, usage } = await generateText({
    model: PROFILE_GENERATION_MODEL,
    system: `You gather concise memory context for profile generation.
Use the search_memories tool when the baseline memories are insufficient or when targeted searches would clarify the user's work, projects, skills, interests, preferences, goals, or personal context.
Return only concise bullet notes. Do not invent details. Do not include sensitive details unless they are clearly relevant to a user-controlled profile.`,
    prompt: `Display name: ${displayName}
Email domain: ${emailDomain}

Baseline memory search results:
${baselineMemories}

Search memories as needed, then return profile-relevant memory notes for the final ProfileTree generator.`,
    tools: {
      search_memories: createProfileMemorySearchTool(userId),
    },
    providerOptions: PROFILE_GENERATION_PROVIDER_OPTIONS,
    stopWhen: stepCountIs(4),
    maxOutputTokens: 700,
  });

  recordLlmCall({
    model: PROFILE_GENERATION_MODEL,
    usage,
    durationMs: performance.now() - start,
    metadata: { operation: "profile-memory-context", route: "/api/profile/summary" },
  });

  return text.trim() || "No additional memory context gathered.";
}

function parseJsonObjectFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Profile JSON response did not contain an object");
    }

    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }
}

async function generateProfileTree(prompt: string) {
  const start = performance.now();

  try {
    const { object, usage } = await generateObject({
      model: PROFILE_GENERATION_MODEL,
      system: SYSTEM,
      prompt,
      schema: ProfileTreeSchema,
      providerOptions: PROFILE_GENERATION_PROVIDER_OPTIONS,
      maxOutputTokens: 900,
    });

    return {
      tree: ProfileTreeSchema.parse(object),
      usage,
      durationMs: performance.now() - start,
    };
  } catch (err) {
    logger.warn(
      "generateProfileTree",
      "Structured profile generation failed; retrying with raw JSON text",
      err
    );

    const retryStart = performance.now();
    const { text, usage } = await generateText({
      model: PROFILE_GENERATION_MODEL,
      system: `${SYSTEM}

Return exactly one raw JSON object. Do not wrap it in Markdown. Do not return an empty object.
Required shape:
{
  "headline": "short profile headline",
  "roles": ["optional role"],
  "signature": "optional signature line",
  "sections": [
    {
      "id": "about",
      "title": "About",
      "body": "section copy",
      "items": ["optional item"],
      "children": []
    }
  ]
}`,
      prompt,
      providerOptions: PROFILE_GENERATION_PROVIDER_OPTIONS,
      maxOutputTokens: 1200,
    });

    return {
      tree: ProfileTreeSchema.parse(parseJsonObjectFromText(text)),
      usage,
      durationMs: performance.now() - retryStart,
    };
  }
}

/**
 * Generates and persists a ProfileTree for the signed-in settings profile.
 * Kept at /api/profile/summary for compatibility with the existing client path.
 */
export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkProfileTreeGenerationLimit(user.userId);

  if (!limit.success) {
    return NextResponse.json({ error: limit.error ?? "Too many requests" }, { status: 429 });
  }

  const sbUserId = await getSupabaseUserId(user.userId);

  if (sbUserId.error || !sbUserId.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: z.infer<typeof RequestSchema>;

  try {
    body = RequestSchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid profile generation request" }, { status: 400 });
  }

  const displayName = body.displayName ?? "User";
  const email = body.email ?? "";
  const emailDomain = email ? (email.split("@")[1] ?? "unknown") : "unknown";

  try {
    const baselineMemories = await getBaselineMemoryContext(sbUserId.data);
    const memoryContext = await gatherMemoryContext({
      userId: sbUserId.data,
      displayName,
      emailDomain,
      baselineMemories,
    });
    const prompt = `Display name: ${displayName}
Email domain: ${email ? emailDomain : "unknown"}

Baseline stored memories:
${baselineMemories}

Tool-gathered memory context:
${memoryContext}

Generate a ProfileTree grounded in the memory context. Avoid inferring sensitive personal details from the email. Use only details that are useful for a user-controlled profile.`;
    const { tree, usage, durationMs } = await generateProfileTree(prompt);

    recordLlmCall({
      model: PROFILE_GENERATION_MODEL,
      usage,
      durationMs,
      metadata: { operation: "profile-tree", route: "/api/profile/summary" },
    });

    const saveResult = await upsertProfileTreeForCurrentUser(tree, "llm-generated");

    if (saveResult.error) {
      return NextResponse.json({ error: "Failed to save profile tree" }, { status: 500 });
    }

    return NextResponse.json({ data: tree });
  } catch (err) {
    logger.error("POST", "Profile tree generation failed", err);

    return NextResponse.json({ error: "Failed to generate profile tree" }, { status: 500 });
  }
}

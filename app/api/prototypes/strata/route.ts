import { auth } from "@clerk/nextjs/server";
import { generateObject, generateText } from "ai";

import { getStrataPageById } from "@/data/supabase/strata";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { clientErrorResponse, logRouteError } from "@/lib/api/client-safe-error";
import { createLogger } from "@/lib/logger";
import {
  StrataGenerateRequestSchema,
  StrataGenerateResponseSchema,
  type StrataGenerationContext,
} from "@/lib/schemas/strata";
import { getStrataCreateSystemPrompt } from "@/lib/system-prompt/strata-create";
import { getStrataUpdateSystemPrompt } from "@/lib/system-prompt/strata-update";
import { createStrataKnowledgeGraphTools } from "@/lib/llm/strata-knowledge-graph-tools";
import { buildPromptSafeRawInputBlock, sanitizeRawUserInput } from "@/lib/strata/input-safety";
import { buildRawDiffPromptBlock } from "@/lib/strata/raw-diff";

export const maxDuration = 30;

const logger = createLogger("app/api/prototypes/strata/route.ts");

function clampTitleToEightWords(title: string): string {
  const words = title.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

  if (words.length === 0) return "Refined Draft";

  return words.slice(0, 8).join(" ");
}

export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = StrataGenerateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const sbUserIdResult = await getSupabaseUserId(user.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return new Response(JSON.stringify({ error: "User not found in supabase" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const sbUserId = sbUserIdResult.data;

  try {
    let sections: {
      raw_text: { content: string; contentJson?: Record<string, unknown> | null };
      refined_text: { content: string };
      elaborated: { content: string };
      design_instructions: { content: string };
      ai_instructions: { content: string };
    } | null = null;

    if (parsed.data.sectionsSnapshot) {
      sections = {
        raw_text: { content: parsed.data.sectionsSnapshot.raw_text },
        refined_text: { content: parsed.data.sectionsSnapshot.refined_text },
        elaborated: { content: parsed.data.sectionsSnapshot.elaborated },
        design_instructions: { content: parsed.data.sectionsSnapshot.design_instructions },
        ai_instructions: { content: parsed.data.sectionsSnapshot.ai_instructions },
      };
      if (parsed.data.rawGenerationMetadata?.generationContext) {
        sections.raw_text.contentJson = {
          generationContext: parsed.data.rawGenerationMetadata.generationContext,
        };
      }
    } else if (parsed.data.pageId) {
      const pageData = await getStrataPageById(parsed.data.pageId);

      if (!pageData) {
        return new Response(JSON.stringify({ error: "Strata page not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      sections = pageData.sections;
    }

    if (!sections) {
      return new Response(JSON.stringify({ error: "No sections available for generation" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const system =
      parsed.data.mode === "create"
        ? getStrataCreateSystemPrompt({
            designInstructions: sections.design_instructions.content,
            aiInstructions: sections.ai_instructions.content,
          })
        : getStrataUpdateSystemPrompt({
            designInstructions: sections.design_instructions.content,
            aiInstructions: sections.ai_instructions.content,
          });

    const sanitizedRawText = sanitizeRawUserInput(sections.raw_text.content);
    const rawInputBlock = buildPromptSafeRawInputBlock(sanitizedRawText);

    const previousGenerationContext =
      (sections.raw_text.contentJson as { generationContext?: StrataGenerationContext } | null)
        ?.generationContext ?? parsed.data.rawGenerationMetadata?.generationContext;
    const previousGeneratedRawText = previousGenerationContext?.lastGeneratedRawText ?? null;

    const rawDiffContext = buildRawDiffPromptBlock({
      previousRawText: previousGeneratedRawText,
      currentRawText: sanitizedRawText,
    });

    const prompt = `Raw Text:
${rawInputBlock}

Current Refined Text:
${sections.refined_text.content}

Current Elaborated:
${sections.elaborated.content}

Mode: ${parsed.data.mode}

${parsed.data.mode === "update" ? `${rawDiffContext.block}\n` : ""}

Return JSON only using the required output schema.`;

    // Tooling pass: force the model to gather memory/graph context before structured generation.
    const searchMemoriesTool =
      process.env.NODE_ENV === "test"
        ? ({ __tool: "search_memories_stub" } as any)
        : (await import("@/lib/llm/strata-memory-tool")).createStrataMemorySearchTool(sbUserId);

    const { text: toolingContext } = await generateText({
      model: "openai/gpt-5.4-mini",
      system: `${system}

This pass exists to gather context using tools before final section generation.
Use tools to collect only relevant context, then return concise bullet notes.
Do not return final Refined/Elaborated content in this pass.`,
      prompt,
      tools: {
        search_memories: searchMemoriesTool,
        ...createStrataKnowledgeGraphTools(),
      },
      maxOutputTokens: 1200,
    });

    const { object } = await generateObject({
      model: "google/gemini-3-flash",
      system,
      prompt: `${prompt}

Tooling context notes (from Mem0 + knowledge graph tools):
${toolingContext}`,
      schema: StrataGenerateResponseSchema,
      maxOutputTokens: 3000,
    });

    const nextRawGenerationContext: StrataGenerationContext = {
      lastGeneratedRawText: sanitizedRawText,
      lastGeneratedAt: new Date().toISOString(),
      lastGenerationMode: parsed.data.mode,
      lastRawDiffSummary: parsed.data.mode === "update" ? rawDiffContext.diffSummary : undefined,
    };

    return Response.json({
      ...object,
      refinedTitle: clampTitleToEightWords(object.refinedTitle),
      rawGenerationContext: nextRawGenerationContext,
    });
  } catch (err) {
    logRouteError(logger, "POST", err);

    return clientErrorResponse(500);
  }
}

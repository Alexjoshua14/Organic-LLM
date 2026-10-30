import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/require-admin";
import { clientErrorJson, logRouteError } from "@/lib/api/client-safe-error";
import {
  generateKnowledgeCapsuleTitleFromSummary,
  KNOWLEDGE_CAPSULE_SUMMARIZER_SYSTEM,
  KNOWLEDGE_CAPSULE_TITLE_SYSTEM,
  parseKnowledgeCapsuleTitle,
} from "@/lib/llm/knowledge-capsule-title";
import {
  CHAT_TITLE_SYSTEM,
  generateShortTitleFromSummary,
} from "@/lib/llm/short-title-from-summary";
import { createLogger } from "@/lib/logger";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";
import { checkTitleGenerationLimit } from "@/lib/rate-limit/title";

export const maxDuration = 30;

const logger = createLogger("app/api/prototypes/knowledge-capsules/preview/route.ts");

const PreviewBodySchema = z.object({
  summary: z.string().min(1).max(8_000),
  /** When true, also run the legacy short-title path for side-by-side comparison. */
  includeLegacy: z.boolean().optional().default(true),
  /** When true, skip LLM and only parse `rawModelOutput` through the grammar. */
  parseOnly: z.boolean().optional().default(false),
  rawModelOutput: z.string().max(2_000).optional(),
});

/**
 * POST /api/prototypes/knowledge-capsules/preview
 *
 * Admin-only lab endpoint: run capsule (and optional legacy) title generation from a summary,
 * or parse-only a raw model string against the grammar.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clerkUserId, sbUserId } = admin;
  const planGate = await requirePlanBudget({ clerkUserId, sbUserId });

  if (planGate) return planGate;

  let bodyJson: unknown;

  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PreviewBodySchema.safeParse(bodyJson);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { summary, includeLegacy, parseOnly, rawModelOutput } = parsed.data;

  if (parseOnly) {
    const raw = (rawModelOutput ?? "").trim();

    if (!raw) {
      return NextResponse.json({ error: "rawModelOutput required when parseOnly" }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        mode: "parseOnly" as const,
        capsule: parseKnowledgeCapsuleTitle(raw),
        prompts: {
          capsuleSystem: KNOWLEDGE_CAPSULE_TITLE_SYSTEM,
          capsuleSummarizer: KNOWLEDGE_CAPSULE_SUMMARIZER_SYSTEM,
          legacySystem: CHAT_TITLE_SYSTEM,
        },
      },
    });
  }

  const limitResult = await checkTitleGenerationLimit(sbUserId, "knowledge-capsule-lab");

  if (!limitResult.success) {
    return NextResponse.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  try {
    const capsuleResult = await generateKnowledgeCapsuleTitleFromSummary(summary, {
      contextId: "knowledge-capsule-lab",
      ownerId: sbUserId,
      operation: "lab-knowledge-capsule-title",
    });

    if (capsuleResult.error) {
      logRouteError(logger, "POST", capsuleResult.error);

      return clientErrorJson(500);
    }

    let legacyTitle: string | null = null;

    if (includeLegacy) {
      const legacyResult = await generateShortTitleFromSummary(summary, {
        contextId: "knowledge-capsule-lab",
        ownerId: sbUserId,
        operation: "lab-legacy-title",
        subject: "chat",
      });

      if (!legacyResult.error) {
        legacyTitle = legacyResult.data ?? "";
      }
    }

    return NextResponse.json({
      data: {
        mode: "generate" as const,
        summary,
        capsule: capsuleResult.data,
        legacyTitle,
        prompts: {
          capsuleSystem: KNOWLEDGE_CAPSULE_TITLE_SYSTEM,
          capsuleSummarizer: KNOWLEDGE_CAPSULE_SUMMARIZER_SYSTEM,
          legacySystem: CHAT_TITLE_SYSTEM,
        },
      },
    });
  } catch (err) {
    logRouteError(logger, "POST", err);

    return clientErrorJson(500);
  }
}

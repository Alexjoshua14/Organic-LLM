import type { RateLimitResult } from "@/lib/rate-limit/llm";

import { generateText } from "ai";
import { z } from "zod";

import {
  buildChatGptPrompt,
  buildCursorInstruction,
  getExportIntentPreset,
  inferExportFormat,
  type ExportFormat,
  type ExportIntentPreset,
} from "@/lib/export/prompts";
import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";

export const ExportPromptRequestSchema = z.object({
  presetId: z.string().min(1),
  exportFormat: z.enum(["open_in_chat", "cursor"]).optional(),
  sourceText: z.string().min(1).max(30_000),
  userContext: z.string().max(10_000).optional(),
  provider: z.string().max(64).optional(),
});

export type ExportPromptRequestBody = z.infer<typeof ExportPromptRequestSchema>;

export type ExportPromptTelemetry = {
  presetId: string;
  presetVersion: number;
  provider: string | null;
  sourceLength: number;
  degraded: boolean;
  latencyMs: number;
  reason?: string;
};

function logExportPromptTelemetry(event: ExportPromptTelemetry): void {
  // Structured server log (never includes sourceText).
  // eslint-disable-next-line no-console -- export-prompt telemetry
  console.info(
    JSON.stringify({
      event: "export-prompt",
      ...event,
    })
  );
}

function buildDeterministic(args: {
  preset: ExportIntentPreset;
  exportFormat: ExportFormat;
  sourceText: string;
  userContext?: string;
}): string {
  if (args.exportFormat === "cursor") {
    return buildCursorInstruction({
      preset: args.preset,
      sourceText: args.sourceText,
      userContext: args.userContext,
    });
  }

  return buildChatGptPrompt({
    preset: args.preset,
    sourceText: args.sourceText,
    userContext: args.userContext,
  });
}

export type HandleExportPromptPostDeps = {
  generateTextImpl: typeof generateText;
  checkLlmMessageLimit: (supabaseUserId: string) => Promise<RateLimitResult>;
};

export type HandleExportPromptPostResult =
  | { ok: true; status: 200; body: { prompt: string; degraded?: boolean; reason?: "rate_limited" } }
  | { ok: false; status: 400; body: { error: string; code?: string } }
  | { ok: false; status: 404; body: { error: string } }
  | { ok: false; status: 500; body: { error: string } };

export async function handleExportPromptPost(
  body: ExportPromptRequestBody,
  supabaseUserId: string,
  deps: HandleExportPromptPostDeps
): Promise<HandleExportPromptPostResult> {
  const preset = getExportIntentPreset(body.presetId);

  if (!preset) {
    return { ok: false, status: 404, body: { error: "Unknown export preset" } };
  }

  if (preset.validate) {
    const validation = preset.validate(body.sourceText);

    if (!validation.ok) {
      return {
        ok: false,
        status: 400,
        body: { error: validation.message, code: "validation_failed" },
      };
    }
  }

  const exportFormat = body.exportFormat ?? inferExportFormat(preset);
  const deterministic = buildDeterministic({
    preset,
    exportFormat,
    sourceText: body.sourceText,
    userContext: body.userContext,
  });

  const telemetryBase = {
    presetId: preset.id,
    presetVersion: preset.version,
    provider: body.provider ?? null,
    sourceLength: body.sourceText.length,
  };

  const started = performance.now();

  const limit = await deps.checkLlmMessageLimit(supabaseUserId);

  if (!limit.success) {
    const latencyMs = Math.round(performance.now() - started);

    logExportPromptTelemetry({
      ...telemetryBase,
      degraded: true,
      latencyMs,
      reason: "rate_limited",
    });

    return {
      ok: true,
      status: 200,
      body: {
        prompt: deterministic,
        degraded: true,
        reason: "rate_limited",
      },
    };
  }

  const deliveryHint =
    exportFormat === "cursor"
      ? "Cursor editor (structured instruction package, clipboard handoff)"
      : "External chat assistants (ChatGPT, Claude, similar)";

  try {
    const { text } = await deps.generateTextImpl({
      model: "openai/gpt-5.4-nano",
      system: `You generate concise, high-quality external-assistant prompts for Organic LLM.
Output only the final prompt text.
No markdown fences.
Respect the delivery target conventions described in the user message.`,
      prompt: `Delivery target: ${deliveryHint}
Preset label: ${preset.label}
Descriptor: ${preset.descriptor ?? "none"}
Question: ${preset.question}
Requested output format: ${preset.requestedFormat}

User context:
${body.userContext?.trim() || "(No additional context provided.)"}

Source material:
${body.sourceText}

Reference fallback prompt:
${deterministic}

Now rewrite the best final prompt to send for this delivery target.`,
      maxOutputTokens: 700,
      providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
    });

    const latencyMs = Math.round(performance.now() - started);

    logExportPromptTelemetry({
      ...telemetryBase,
      degraded: false,
      latencyMs,
    });

    return {
      ok: true,
      status: 200,
      body: {
        prompt: text.trim() || deterministic,
      },
    };
  } catch {
    const latencyMs = Math.round(performance.now() - started);

    logExportPromptTelemetry({
      ...telemetryBase,
      degraded: true,
      latencyMs,
      reason: "generation_failed",
    });

    return {
      ok: true,
      status: 200,
      body: {
        prompt: deterministic,
        degraded: true,
      },
    };
  }
}

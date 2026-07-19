import type { SpeakModalities } from "@/lib/schemas/speak-modalities";

import { GenUIBlockSchema } from "@/lib/schemas/gen-ui";
import { httpUrl } from "@/lib/schemas/gen-ui/shared";
import { z } from "zod";

/** OpenAI Realtime function-tool shape. */
export type SpeakRealtimeFunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

function toParameters(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
  const { $schema: _s, ...rest } = json;

  return rest;
}

const UpdateDisplayTextSchema = z.object({
  text: z.string().min(1).max(2_000),
});

const ShowWebPreviewSchema = z.object({
  url: httpUrl(),
  title: z.string().max(120).optional(),
});

/** Loose schema for Realtime JSON Schema; GenUIBlockSchema validates on execute. */
const RenderGenUiRealtimeSchema = z.object({
  block: z.record(z.string(), z.unknown()),
  instanceId: z.string().uuid().optional(),
});

const RenderGenUiSchema = z.object({
  block: GenUIBlockSchema,
  instanceId: z.string().uuid().optional(),
});

const RefreshComponentSchema = z.object({
  instanceId: z.string().uuid(),
});

const UpsertUiStateSchema = z.object({
  surfaceId: z.string().min(1).max(120),
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        data: z.record(z.string(), z.unknown()),
      })
    )
    .max(50),
});

const UpdateThreadTitleSchema = z.object({
  hint: z.string().max(200).optional(),
});

const SummarizeThreadSchema = z.object({
  reason: z.string().max(200).optional(),
});

/**
 * Compile modality-gated Realtime tools. Always includes async nanobot tools
 * that need a thread; they no-op gracefully without one.
 */
export function compileSpeakRealtimeTools(
  modalities: SpeakModalities
): SpeakRealtimeFunctionTool[] {
  const tools: SpeakRealtimeFunctionTool[] = [];

  if (modalities.text) {
    tools.push({
      type: "function",
      name: "update_display_text",
      description:
        "Update the on-screen caption/transcript text. Keep it short; speech remains primary.",
      parameters: toParameters(UpdateDisplayTextSchema),
    });
  }

  if (modalities.genUi) {
    tools.push({
      type: "function",
      name: "render_gen_ui",
      description:
        "Render one GenUI block in the Speak visual panel. Prefer when structure helps more than speech alone. Pass `{ block: { type, version, ...fields } }`.",
      parameters: toParameters(RenderGenUiRealtimeSchema),
    });
    tools.push({
      type: "function",
      name: "refresh_component",
      description: "Ask the client to remount a GenUI block by instanceId.",
      parameters: toParameters(RefreshComponentSchema),
    });
    tools.push({
      type: "function",
      name: "upsert_ui_state",
      description: "Patch a JSON item snapshot for a live Speak UI surface.",
      parameters: toParameters(UpsertUiStateSchema),
    });
  }

  if (modalities.web) {
    tools.push({
      type: "function",
      name: "show_web_preview",
      description: "Show an https URL in the Speak web preview panel.",
      parameters: toParameters(ShowWebPreviewSchema),
    });
  }

  tools.push({
    type: "function",
    name: "update_thread_title",
    description: "Async nanobot: refresh the conversation title when the topic is clear.",
    parameters: toParameters(UpdateThreadTitleSchema),
  });

  tools.push({
    type: "function",
    name: "summarize_thread",
    description: "Async nanobot: update the thread summary without reading it aloud.",
    parameters: toParameters(SummarizeThreadSchema),
  });

  return tools;
}

export const SpeakToolNameSchema = z.enum([
  "update_display_text",
  "render_gen_ui",
  "refresh_component",
  "upsert_ui_state",
  "show_web_preview",
  "update_thread_title",
  "summarize_thread",
]);

export type SpeakToolName = z.infer<typeof SpeakToolNameSchema>;

export function isToolAllowedForModalities(
  name: SpeakToolName,
  modalities: SpeakModalities
): boolean {
  switch (name) {
    case "update_display_text":
      return modalities.text;
    case "render_gen_ui":
    case "refresh_component":
    case "upsert_ui_state":
      return modalities.genUi;
    case "show_web_preview":
      return modalities.web;
    case "update_thread_title":
    case "summarize_thread":
      return true;
    default:
      return false;
  }
}

export {
  UpdateDisplayTextSchema,
  ShowWebPreviewSchema,
  RenderGenUiSchema,
  RefreshComponentSchema,
  UpsertUiStateSchema,
  UpdateThreadTitleSchema,
  SummarizeThreadSchema,
};

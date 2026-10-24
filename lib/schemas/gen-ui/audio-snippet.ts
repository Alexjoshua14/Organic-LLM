import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const AudioSnippetPreviewSchema = z.object({
  title: z.string().min(1),
  teaser: z.string().min(1),
  duration: optionalStringCatch(),
});

export const AudioSnippetMetaSchema = z.object({
  estimatedDuration: optionalStringCatch(),
  voice: optionalStringCatch(),
  tone: optionalStringCatch(),
});

export const AudioSnippetBlockSchema = z.object({
  type: z.literal("audio-snippet"),
  version: GEN_UI_VERSION,
  preview: AudioSnippetPreviewSchema,
  script: z.string().min(1).max(2000),
  voiceId: z.string().optional(),
  meta: AudioSnippetMetaSchema.optional(),
});

export type AudioSnippetBlock = z.infer<typeof AudioSnippetBlockSchema>;

export function audioSnippetToMarkdown(block: AudioSnippetBlock): string {
  const lines: string[] = [`## ${block.preview.title}`, "", block.preview.teaser];

  if (block.preview.duration) {
    lines.push("", `_Duration: ${block.preview.duration}_`);
  }

  lines.push("", "### Script", "", block.script);

  return lines.join("\n").trim();
}

export function audioSnippetToMarkdownLoose(raw: Record<string, unknown>): string {
  const preview =
    raw.preview && typeof raw.preview === "object" ? (raw.preview as Record<string, unknown>) : {};
  const title = typeof preview.title === "string" ? preview.title : "Audio recap";
  const teaser = typeof preview.teaser === "string" ? preview.teaser : "";
  const script = typeof raw.script === "string" ? raw.script : "";

  return audioSnippetToMarkdown({
    type: "audio-snippet",
    version: 1,
    preview: { title, teaser },
    script: script || "(script unavailable)",
  });
}

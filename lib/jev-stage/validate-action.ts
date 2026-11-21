import { z } from "zod";

import type { JevStageCandidate } from "./schema";

import { StageSubagentAssignmentSchema } from "@/lib/stage/schema";
import { StageViewSchema } from "@/lib/stage/view-schema";

/**
 * Returns null when the selected action has usable args; otherwise a fallback reason.
 * Invalid selections should fall through to Respond instead of a no-op “ok” turn.
 */
export function invalidSelectedActionReason(selected: JevStageCandidate): string | null {
  switch (selected.kind) {
    case "respond":
    case "orchestrate":
      return null;
    case "view_switch":
      return StageViewSchema.safeParse(selected.args.view).success
        ? null
        : "view_switch missing a valid view";
    case "captures": {
      const parsed = z
        .array(z.object({ text: z.string().min(1) }).passthrough())
        .min(1)
        .safeParse(selected.args.captures);

      return parsed.success ? null : "captures requires a non-empty captures array";
    }
    case "recall":
      return null;
    case "designer_brief": {
      const brief = selected.args.brief;

      return typeof brief === "string" && brief.trim()
        ? null
        : "designer_brief requires args.brief";
    }
    case "specialists": {
      const parsed = z.array(StageSubagentAssignmentSchema).min(1).max(2).safeParse(
        selected.args.subagents
      );

      return parsed.success ? null : "specialists requires args.subagents";
    }
    case "memory_search":
    case "web_search":
      return null;
    default:
      return `unknown action ${(selected as { kind: string }).kind}`;
  }
}

export function settingsBlockReason(
  kind: JevStageCandidate["kind"],
  settings: { memory?: boolean; webSearch?: boolean } | undefined
): string | null {
  if ((kind === "memory_search" || kind === "recall") && settings?.memory === false) {
    return `${kind} blocked: memory is off`;
  }
  if (kind === "web_search" && settings?.webSearch === false) {
    return "web_search blocked: web search is off";
  }

  return null;
}

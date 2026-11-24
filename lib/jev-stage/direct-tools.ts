import "server-only";

import type { JevStageCandidate } from "./schema";
import { isExplicitStageClear } from "./validate-action";
import { leanPhraseContext, type JevPhraseOmitTool } from "./phrase";

import { fileStageCaptures, placeStageRecall, type StageCapture } from "@/lib/stage/knowledge";
import { recallStageMemories } from "@/lib/stage/memory";
import { assignStageSubagents } from "@/lib/stage/subagent-state";
import { placeStageArtifacts } from "@/lib/stage/artifacts";
import { StageLayoutError } from "@/lib/stage/layout";
import { resolveStageView } from "@/lib/stage/views";
import {
  STAGE_MAX_PENDING_DESIGNS,
  StageSubagentAssignmentSchema,
  type StageState,
  type StageTurnSettings,
} from "@/lib/stage/schema";
import { StageViewSchema } from "@/lib/stage/view-schema";
import { createMemorySearchTool, createWebSearchTool } from "@/lib/llm/llm-tool-kit";
import { z } from "zod";

export type DirectToolResult = {
  state: StageState;
  /** Optional caption when something should also appear in Conversation. */
  note: string | null;
  /**
   * Lookup directs patch Stage then hand off to Respond for a real reply.
   * Surface-only actions leave this false and may end on `note`.
   */
  needsPhrase: boolean;
  /** Lean digest for the phrase hop (capped); null when no phrase is needed. */
  phraseContext: string | null;
  /** Skip duplicate lookup tools on the phrase hop when the digest already has substance. */
  omitLookupTools: JevPhraseOmitTool[];
};

function surfaceResult(state: StageState, note: string | null): DirectToolResult {
  return { state, note, needsPhrase: false, phraseContext: null, omitLookupTools: [] };
}

function asCaptures(raw: unknown): StageCapture[] {
  const parsed = z
    .array(
      z.object({
        text: z.string().min(1).max(500),
        collectionId: z.string().uuid().nullable().optional(),
        collection: z.string().min(1).max(80).optional(),
      })
    )
    .safeParse(raw);

  if (!parsed.success) return [];

  return parsed.data.map((item) => ({
    text: item.text,
    collectionId: item.collectionId ?? null,
    collection: (item.collection ?? "Ideas").slice(0, 60),
  }));
}

/**
 * Execute a Stage-surface tool without an LLM phrasing step. Results patch Stage state
 * (view, pieces, captures, recall, designer job, specialists) directly.
 */
export async function executeJevDirectTool(args: {
  ownerId: string;
  state: StageState;
  selected: JevStageCandidate;
  message: string;
  requestId: string;
  settings?: StageTurnSettings;
}): Promise<DirectToolResult> {
  const { selected, message, requestId, settings } = args;
  let state = args.state;

  switch (selected.kind) {
    case "view_switch": {
      const view = StageViewSchema.safeParse(selected.args.view);

      if (!view.success) {
        return surfaceResult(state, "Jev asked for a view switch but the view was invalid.");
      }
      const target = resolveStageView(state, view.data);

      if (!target) return surfaceResult(state, "That view is no longer available.");
      const presentation = settings?.presentation ?? state.presentation;

      state = {
        ...state,
        revision: state.revision + 1,
        ...(presentation
          ? { presentation: { ...presentation, view: target, page: 0, reading: false } }
          : {}),
        viewCommand: { id: requestId, target },
      };

      return surfaceResult(state, null);
    }
    case "captures": {
      const captures = asCaptures(selected.args.captures);

      if (!captures.length) {
        return surfaceResult(state, "No captures were provided.");
      }
      const withMessages = {
        ...state,
        revision: state.revision + 1,
        messages: [
          ...state.messages,
          { id: requestId, role: "user" as const, text: message },
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            text: `Filed ${captures.length} capture${captures.length === 1 ? "" : "s"}.`,
          },
        ].slice(-24),
      };
      const filing = fileStageCaptures(withMessages, captures);

      return surfaceResult(
        filing.state,
        filing.unfiled.length
          ? `Filed ${filing.filed.length}; ${filing.unfiled.length} needed more room.`
          : null
      );
    }
    case "recall": {
      const query =
        typeof selected.args.query === "string" && selected.args.query.trim()
          ? selected.args.query.trim().slice(0, 300)
          : message.slice(0, 300);
      const memories = (await recallStageMemories(args.ownerId, query)) ?? [];
      const items = memories
        .map((memory) => memory.text.trim().slice(0, 180))
        .filter(Boolean)
        .slice(0, 8);
      const next = placeStageRecall(
        { ...state, revision: state.revision + 1 },
        query,
        memories
      );

      // Patch Recall on Stage; Respond phrases the answer from the lean digest.
      return {
        state: next,
        note: null,
        needsPhrase: true,
        phraseContext: leanPhraseContext("recall", {
          query,
          itemCount: memories.length,
          items,
        }),
        omitLookupTools: items.length
          ? (["search_memories", "recall_memories"] satisfies JevPhraseOmitTool[])
          : [],
      };
    }
    case "clear_pieces": {
      if (!isExplicitStageClear(message)) {
        return surfaceResult(
          state,
          "I can’t restore an earlier Stage revision here. The canvas was left as it was."
        );
      }
      const before = state.widgets.length;
      const widgets = state.widgets.filter(
        (widget) => widget.kind === "collection" || widget.kind === "recall"
      );
      const cleared = before - widgets.length;

      state = {
        ...state,
        revision: state.revision + 1,
        widgets,
        messages: [
          ...state.messages,
          { id: requestId, role: "user" as const, text: message },
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            text:
              cleared > 0
                ? `Cleared ${cleared} piece${cleared === 1 ? "" : "s"} from the stage.`
                : "The stage was already clear.",
          },
        ].slice(-24),
      };

      return surfaceResult(state, null);
    }
    case "designer_brief": {
      if (state.design && state.pendingDesigns.length >= STAGE_MAX_PENDING_DESIGNS) {
        return surfaceResult(
          state,
          "The designer queue is full. Try again after a design finishes."
        );
      }
      const brief =
        typeof selected.args.brief === "string" && selected.args.brief.trim()
          ? selected.args.brief.trim().slice(0, 2000)
          : message.slice(0, 2000);
      const job = { id: requestId, brief };

      state = {
        ...state,
        revision: state.revision + 1,
        messages: [
          ...state.messages,
          { id: requestId, role: "user" as const, text: message },
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            text: "Queued a layout for the designer.",
          },
        ].slice(-24),
        design: state.design
          ? state.design
          : {
              ...job,
              status: "working" as const,
              phase: "queued" as const,
              startedAt: new Date().toISOString(),
            },
        pendingDesigns: state.design ? [...state.pendingDesigns, job] : state.pendingDesigns,
      };

      return surfaceResult(state, null);
    }
    case "specialists": {
      const parsed = z
        .array(StageSubagentAssignmentSchema)
        .max(2)
        .safeParse(selected.args.subagents);
      const assignments = parsed.success ? parsed.data : [];

      if (!assignments.length) {
        return surfaceResult(state, "No specialist assignments were provided.");
      }
      try {
        state = assignStageSubagents(
          {
            ...state,
            revision: state.revision + 1,
            messages: [
              ...state.messages,
              { id: requestId, role: "user" as const, text: message },
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                text: `Started ${assignments.length} specialist${assignments.length === 1 ? "" : "s"}.`,
              },
            ].slice(-24),
          },
          assignments,
          settings
        );
      } catch (error) {
        if (error instanceof StageLayoutError) {
          return surfaceResult(
            state,
            "Make room below Organic before starting specialists."
          );
        }
        throw error;
      }

      return surfaceResult(state, null);
    }
    case "memory_search": {
      const query =
        typeof selected.args.query === "string" && selected.args.query.trim()
          ? selected.args.query.trim()
          : message;
      const memoryTool = createMemorySearchTool(args.ownerId);
      const execute = memoryTool.execute as
        | ((input: { query: string }) => Promise<unknown>)
        | undefined;

      if (!execute) return surfaceResult(state, "Memory search is unavailable.");
      const raw = await execute({ query });
      const text =
        typeof raw === "string"
          ? raw
          : JSON.stringify(raw).slice(0, 4000) || "No memories matched.";
      const excerpt = text.slice(0, 1200);
      const placed = placeStageArtifacts(
        { ...state, revision: state.revision + 1 },
        text.slice(0, 1800),
        "Organic"
      );

      return {
        state: placed,
        note: null,
        needsPhrase: true,
        phraseContext: leanPhraseContext("memory_search", { query, excerpt }),
        omitLookupTools: excerpt.trim()
          ? (["search_memories"] satisfies JevPhraseOmitTool[])
          : [],
      };
    }
    case "web_search": {
      const query =
        typeof selected.args.query === "string" && selected.args.query.trim()
          ? selected.args.query.trim()
          : message;
      const webTool = createWebSearchTool({ maxNumResults: 3, sbUserId: args.ownerId });
      const execute = webTool.execute as
        | ((input: { query: string }) => Promise<unknown>)
        | undefined;

      if (!execute) return surfaceResult(state, "Web search is unavailable.");
      const raw = await execute({ query });
      const text =
        typeof raw === "string" ? raw : JSON.stringify(raw).slice(0, 4000) || "No web results.";
      const excerpt = text.slice(0, 1200);
      const placed = placeStageArtifacts(
        { ...state, revision: state.revision + 1 },
        text.slice(0, 1800),
        "Organic"
      );

      return {
        state: placed,
        note: null,
        needsPhrase: true,
        phraseContext: leanPhraseContext("web_search", { query, excerpt }),
        omitLookupTools: excerpt.trim()
          ? (["web_search"] satisfies JevPhraseOmitTool[])
          : [],
      };
    }
    default:
      return surfaceResult(state, `Direct tool ${selected.kind} is not wired.`);
  }
}

export function isDirectJevAction(kind: JevStageCandidate["kind"]): boolean {
  return kind !== "respond" && kind !== "orchestrate";
}

import "server-only";

import type { JevStageCandidate } from "./schema";

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
};

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
        return { state, note: "Jev asked for a view switch but the view was invalid." };
      }
      const target = resolveStageView(state, view.data);

      if (!target) return { state, note: "That view is no longer available." };
      const presentation = settings?.presentation ?? state.presentation;

      state = {
        ...state,
        revision: state.revision + 1,
        ...(presentation
          ? { presentation: { ...presentation, view: target, page: 0, reading: false } }
          : {}),
        viewCommand: { id: requestId, target },
      };

      return { state, note: null };
    }
    case "captures": {
      const captures = asCaptures(selected.args.captures);

      if (!captures.length) {
        return { state, note: "No captures were provided." };
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

      return {
        state: filing.state,
        note: filing.unfiled.length
          ? `Filed ${filing.filed.length}; ${filing.unfiled.length} needed more room.`
          : null,
      };
    }
    case "recall": {
      const query =
        typeof selected.args.query === "string" && selected.args.query.trim()
          ? selected.args.query.trim().slice(0, 300)
          : message.slice(0, 300);
      const memories = (await recallStageMemories(args.ownerId, query)) ?? [];
      const next = placeStageRecall(
        {
          ...state,
          revision: state.revision + 1,
          messages: [
            ...state.messages,
            { id: requestId, role: "user" as const, text: message },
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              text: `Refreshed Recall for “${query}”.`,
            },
          ].slice(-24),
        },
        query,
        memories
      );

      return { state: next, note: null };
    }
    case "designer_brief": {
      if (state.design && state.pendingDesigns.length >= STAGE_MAX_PENDING_DESIGNS) {
        return { state, note: "The designer queue is full. Try again after a design finishes." };
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

      return { state, note: null };
    }
    case "specialists": {
      const parsed = z
        .array(StageSubagentAssignmentSchema)
        .max(2)
        .safeParse(selected.args.subagents);
      const assignments = parsed.success ? parsed.data : [];

      if (!assignments.length) {
        return { state, note: "No specialist assignments were provided." };
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
          return {
            state,
            note: "Make room below Organic before starting specialists.",
          };
        }
        throw error;
      }

      return { state, note: null };
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

      if (!execute) return { state, note: "Memory search is unavailable." };
      const raw = await execute({ query });
      const text =
        typeof raw === "string"
          ? raw
          : JSON.stringify(raw).slice(0, 4000) || "No memories matched.";
      const placed = placeStageArtifacts(
        {
          ...state,
          revision: state.revision + 1,
          messages: [
            ...state.messages,
            { id: requestId, role: "user" as const, text: message },
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              text: "Pulled matching memories onto the stage.",
            },
          ].slice(-24),
        },
        text.slice(0, 1800),
        "Organic"
      );

      return { state: placed, note: null };
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

      if (!execute) return { state, note: "Web search is unavailable." };
      const raw = await execute({ query });
      const text =
        typeof raw === "string" ? raw : JSON.stringify(raw).slice(0, 4000) || "No web results.";
      const placed = placeStageArtifacts(
        {
          ...state,
          revision: state.revision + 1,
          messages: [
            ...state.messages,
            { id: requestId, role: "user" as const, text: message },
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              text: "Placed web findings on the stage.",
            },
          ].slice(-24),
        },
        text.slice(0, 1800),
        "Organic"
      );

      return { state: placed, note: null };
    }
    default:
      return { state, note: `Direct tool ${selected.kind} is not wired.` };
  }
}

export function isDirectJevAction(kind: JevStageCandidate["kind"]): boolean {
  return (
    kind !== "respond" &&
    kind !== "orchestrate"
  );
}

/**
 * Pure session → timeline → frame derivation for public showcase replays.
 * Finished UIMessage objects keep stable identity across frames so memoized
 * ChatMessage rows only re-render when their own content changes.
 */

import type { ChatStatus, UIMessage } from "ai";

import {
  REPLAY_ASSISTANT_MS_PER_TOKEN,
  REPLAY_CHAPTER_PAUSE_MS,
  REPLAY_COMPOSER_MS_PER_CHAR,
  REPLAY_COMPOSER_SETTLE_MS,
  REPLAY_LOOP_HOLD_MS,
  REPLAY_THINKING_PAUSE_MS,
  REPLAY_TOOL_IN_FLIGHT_MS,
  REPLAY_TOOL_INITIATE_IN_FLIGHT_MS,
} from "./replay-timing";

import { ChatAIActionEnum } from "@/types/ai";

export type ReplayTextStep = {
  kind: "text";
  text: string;
};

export type ReplayToolStep = {
  kind: "tool";
  toolName: string;
  toolCallId?: string;
  input: unknown;
  output: unknown;
  /** Side-channel payload applied when the tool completes (e.g. kanban command). */
  effect?: unknown;
  /** Override in-flight duration (ms). */
  inFlightMs?: number;
};

export type ReplayStep = ReplayTextStep | ReplayToolStep;

export type ReplayChapter = {
  id: string;
  title: string;
  caption: string;
  user: string;
  assistant: ReplayStep[];
};

export type ReplaySession = {
  id: string;
  chapters: ReplayChapter[];
};

export type ReplayAiActionPayload = {
  action: ChatAIActionEnum;
  message?: string;
};

export type ReplayFrame = {
  messages: UIMessage[];
  composerText: string;
  status: ChatStatus;
  aiActionPayload: ReplayAiActionPayload | undefined;
  /** How many effects from the compiled timeline have been applied by this t. */
  effectsApplied: number;
  chapterIndex: number;
  /** Absolute time of this frame (clamped). */
  tMs: number;
  durationMs: number;
  complete: boolean;
};

type EffectEntry = {
  atMs: number;
  effect: unknown;
};

type CompiledTextStep = {
  kind: "text";
  startMs: number;
  endMs: number;
  fullText: string;
  tokens: string[];
};

type CompiledToolStep = {
  kind: "tool";
  startMs: number;
  completeMs: number;
  endMs: number;
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
  effectIndex: number | null;
};

type CompiledAssistantStep = CompiledTextStep | CompiledToolStep;

type CompiledChapter = {
  id: string;
  title: string;
  caption: string;
  index: number;
  /** Composer starts typing. */
  composerStartMs: number;
  /** User bubble appears. */
  userAppearMs: number;
  userMessageId: string;
  userText: string;
  /** Thinking / streaming window for the assistant. */
  thinkingStartMs: number;
  assistantStartMs: number;
  assistantEndMs: number;
  chapterEndMs: number;
  assistantMessageId: string;
  steps: CompiledAssistantStep[];
};

export type CompiledReplay = {
  sessionId: string;
  chapters: CompiledChapter[];
  effects: EffectEntry[];
  durationMs: number;
  /** Pre-built finished messages for identity stability. */
  finishedUserByChapter: UIMessage[];
  finishedAssistantByChapter: UIMessage[];
};

function tokens(text: string): string[] {
  return text.match(/\S+\s*/g) ?? (text.length > 0 ? [text] : []);
}

function toolInFlightMs(step: ReplayToolStep): number {
  if (typeof step.inFlightMs === "number") return step.inFlightMs;
  const type =
    step.input &&
    typeof step.input === "object" &&
    "command" in step.input &&
    step.input.command &&
    typeof step.input.command === "object" &&
    "type" in (step.input.command as object)
      ? String((step.input.command as { type: unknown }).type)
      : undefined;

  if (type === "INITIATE_KANBAN") return REPLAY_TOOL_INITIATE_IN_FLIGHT_MS;

  return REPLAY_TOOL_IN_FLIGHT_MS;
}

function buildAssistantParts(steps: CompiledAssistantStep[], tMs: number): UIMessage["parts"] {
  const parts: UIMessage["parts"] = [];

  for (const step of steps) {
    if (tMs < step.startMs) break;

    if (step.kind === "text") {
      const elapsed = Math.max(0, tMs - step.startMs);
      const shownCount =
        tMs >= step.endMs
          ? step.tokens.length
          : Math.min(step.tokens.length, Math.floor(elapsed / REPLAY_ASSISTANT_MS_PER_TOKEN));
      const text = step.tokens.slice(0, shownCount).join("");
      const done = tMs >= step.endMs;

      parts.push({
        type: "text",
        text,
        state: done ? ("done" as const) : ("streaming" as const),
      });
      continue;
    }

    const done = tMs >= step.completeMs;

    if (done) {
      parts.push({
        type: "dynamic-tool",
        toolName: step.toolName,
        toolCallId: step.toolCallId,
        state: "output-available",
        input: step.input,
        output: step.output,
      });
    } else {
      parts.push({
        type: "dynamic-tool",
        toolName: step.toolName,
        toolCallId: step.toolCallId,
        state: "input-streaming",
        input: step.input,
      });
    }
  }

  return parts;
}

function finishedAssistantMessage(chapter: CompiledChapter): UIMessage {
  return {
    id: chapter.assistantMessageId,
    role: "assistant",
    parts: buildAssistantParts(chapter.steps, chapter.assistantEndMs),
  };
}

function finishedUserMessage(chapter: CompiledChapter): UIMessage {
  return {
    id: chapter.userMessageId,
    role: "user",
    parts: [{ type: "text", text: chapter.userText }],
  };
}

/**
 * Compile a hand-authored session into absolute-time chapters + effects.
 */
export function compileReplay(session: ReplaySession): CompiledReplay {
  let t = 0;
  const chapters: CompiledChapter[] = [];
  const effects: EffectEntry[] = [];

  session.chapters.forEach((chapter, index) => {
    const composerStartMs = t;
    const typingMs = chapter.user.length * REPLAY_COMPOSER_MS_PER_CHAR;
    const userAppearMs = composerStartMs + typingMs + REPLAY_COMPOSER_SETTLE_MS;
    const thinkingStartMs = userAppearMs;
    const assistantStartMs = thinkingStartMs + REPLAY_THINKING_PAUSE_MS;

    let cursor = assistantStartMs;
    const steps: CompiledAssistantStep[] = [];

    chapter.assistant.forEach((step, stepIndex) => {
      if (step.kind === "text") {
        const toks = tokens(step.text);
        const duration = Math.max(toks.length, 1) * REPLAY_ASSISTANT_MS_PER_TOKEN;
        const startMs = cursor;
        const endMs = startMs + duration;

        steps.push({
          kind: "text",
          startMs,
          endMs,
          fullText: step.text,
          tokens: toks,
        });
        cursor = endMs;
      } else {
        const inFlight = toolInFlightMs(step);
        const startMs = cursor;
        const completeMs = startMs + inFlight;
        const toolCallId = step.toolCallId ?? `${session.id}-${chapter.id}-tool-${stepIndex}`;
        let effectIndex: number | null = null;

        if (step.effect !== undefined) {
          effectIndex = effects.length;
          effects.push({ atMs: completeMs, effect: step.effect });
        }

        steps.push({
          kind: "tool",
          startMs,
          completeMs,
          endMs: completeMs,
          toolName: step.toolName,
          toolCallId,
          input: step.input,
          output: step.output,
          effectIndex,
        });
        cursor = completeMs;
      }
    });

    const assistantEndMs = cursor;
    const chapterEndMs = assistantEndMs + REPLAY_CHAPTER_PAUSE_MS;

    chapters.push({
      id: chapter.id,
      title: chapter.title,
      caption: chapter.caption,
      index,
      composerStartMs,
      userAppearMs,
      userMessageId: `${session.id}-${chapter.id}-user`,
      userText: chapter.user,
      thinkingStartMs,
      assistantStartMs,
      assistantEndMs,
      chapterEndMs,
      assistantMessageId: `${session.id}-${chapter.id}-assistant`,
      steps,
    });

    t = chapterEndMs;
  });

  const durationMs = t + REPLAY_LOOP_HOLD_MS;
  const finishedUserByChapter = chapters.map(finishedUserMessage);
  const finishedAssistantByChapter = chapters.map(finishedAssistantMessage);

  return {
    sessionId: session.id,
    chapters,
    effects,
    durationMs,
    finishedUserByChapter,
    finishedAssistantByChapter,
  };
}

function chapterAt(timeline: CompiledReplay, tMs: number): CompiledChapter {
  const last = timeline.chapters[timeline.chapters.length - 1]!;

  for (const chapter of timeline.chapters) {
    if (tMs < chapter.chapterEndMs) return chapter;
  }

  return last;
}

function countEffectsApplied(timeline: CompiledReplay, tMs: number): number {
  let n = 0;

  for (const effect of timeline.effects) {
    if (effect.atMs <= tMs) n += 1;
    else break;
  }

  return n;
}

/**
 * Derive the UI frame at absolute time `tMs` (clamped to [0, duration]).
 * Finished chapter messages reuse pre-built objects for referential stability.
 */
export function deriveReplayFrame(timeline: CompiledReplay, tMsRaw: number): ReplayFrame {
  const tMs = Math.max(0, Math.min(tMsRaw, timeline.durationMs));
  const complete = tMs >= timeline.durationMs;
  const effectsApplied = countEffectsApplied(timeline, tMs);
  const active = chapterAt(timeline, tMs);
  const messages: UIMessage[] = [];

  // Prior finished chapters — stable identity.
  for (let i = 0; i < active.index; i++) {
    messages.push(timeline.finishedUserByChapter[i]!);
    messages.push(timeline.finishedAssistantByChapter[i]!);
  }

  let composerText = "";
  let status: ChatStatus = "ready";
  let aiActionPayload: ReplayAiActionPayload | undefined;

  if (tMs < active.composerStartMs) {
    // Between chapters / hold — prior chapters only.
  } else if (tMs < active.userAppearMs) {
    const elapsed = tMs - active.composerStartMs;
    const chars = Math.min(
      active.userText.length,
      Math.floor(elapsed / REPLAY_COMPOSER_MS_PER_CHAR)
    );

    composerText = active.userText.slice(0, chars);
  } else {
    // User bubble is visible.
    if (tMs >= active.assistantEndMs) {
      messages.push(timeline.finishedUserByChapter[active.index]!);
      messages.push(timeline.finishedAssistantByChapter[active.index]!);
      status = "ready";
    } else if (tMs < active.assistantStartMs) {
      messages.push(timeline.finishedUserByChapter[active.index]!);
      status = "submitted";
      aiActionPayload = {
        action: ChatAIActionEnum.Processing,
        message: "Planning response…",
      };
    } else {
      messages.push(timeline.finishedUserByChapter[active.index]!);
      status = "streaming";
      messages.push({
        id: active.assistantMessageId,
        role: "assistant",
        parts: buildAssistantParts(active.steps, tMs),
      });

      const streamingTool = active.steps.find(
        (s) => s.kind === "tool" && tMs >= s.startMs && tMs < s.completeMs
      );

      if (streamingTool && streamingTool.kind === "tool") {
        aiActionPayload = {
          action: ChatAIActionEnum.Tool,
          message: `Using tool: ${streamingTool.toolName}`,
        };
      }
    }
  }

  return {
    messages,
    composerText,
    status,
    aiActionPayload,
    effectsApplied,
    chapterIndex: active.index,
    tMs,
    durationMs: timeline.durationMs,
    complete,
  };
}

/** Absolute start times for chapter seek / pills. */
export function chapterStartTimes(timeline: CompiledReplay): number[] {
  return timeline.chapters.map((c) => c.composerStartMs);
}

/** Effects list in apply order (for store sync). */
export function replayEffects(timeline: CompiledReplay): unknown[] {
  return timeline.effects.map((e) => e.effect);
}

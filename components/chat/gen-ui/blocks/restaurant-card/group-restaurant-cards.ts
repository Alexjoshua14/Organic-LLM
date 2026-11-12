import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

import { RENDER_GEN_UI_TOOL_NAME } from "@/lib/llm/gen-ui-tool";
import { GATHER_RESTAURANT_TOOL_NAME } from "@/lib/llm/restaurant-tool";
import { extractGenUIBlockFromToolOutput, safeParseGenUIBlock } from "@/lib/schemas/gen-ui";

/**
 * Tokens for restaurant-card adjacency grouping.
 * - `restaurant` — completed restaurant-card gen-UI that can join a carousel run
 * - `transparent` — part that renders nothing (or is folded); does not break a run
 * - `opaque` — visible non-restaurant content; breaks a run
 */
export type RestaurantGroupingToken =
  | { kind: "restaurant"; partIndex: number; block: RestaurantCardBlock }
  | { kind: "transparent" }
  | { kind: "opaque" };

export type RestaurantCardGroup =
  | { type: "single"; partIndex: number; block: RestaurantCardBlock }
  | { type: "carousel"; partIndices: number[]; blocks: RestaurantCardBlock[] };

export type RestaurantCardRenderPlan = {
  /** Carousel groups keyed by the first part index in the run. */
  carouselsByStartIndex: Map<number, Extract<RestaurantCardGroup, { type: "carousel" }>>;
  /** Restaurant part indices absorbed into a carousel (including the start). */
  carouselPartIndices: Set<number>;
};

/**
 * Pure grouping: adjacent restaurant tokens coalesce; opaque tokens split runs;
 * transparent tokens are ignored for adjacency.
 *
 * 1 restaurant → `single`; 2+ adjacent → `carousel`; restaurants separated by
 * opaque content stay as separate groups.
 */
export function groupAdjacentRestaurantCards(
  tokens: readonly RestaurantGroupingToken[]
): RestaurantCardGroup[] {
  const groups: RestaurantCardGroup[] = [];
  let run: Extract<RestaurantGroupingToken, { kind: "restaurant" }>[] = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length === 1) {
      groups.push({
        type: "single",
        partIndex: run[0].partIndex,
        block: run[0].block,
      });
    } else {
      groups.push({
        type: "carousel",
        partIndices: run.map((item) => item.partIndex),
        blocks: run.map((item) => item.block),
      });
    }
    run = [];
  };

  for (const token of tokens) {
    if (token.kind === "transparent") continue;
    if (token.kind === "opaque") {
      flush();
      continue;
    }
    run.push(token);
  }
  flush();

  return groups;
}

/** Index carousel groups for O(1) lookup while mapping message parts. */
export function planRestaurantCardRendering(
  tokens: readonly RestaurantGroupingToken[]
): RestaurantCardRenderPlan {
  const carouselsByStartIndex = new Map<
    number,
    Extract<RestaurantCardGroup, { type: "carousel" }>
  >();
  const carouselPartIndices = new Set<number>();

  for (const group of groupAdjacentRestaurantCards(tokens)) {
    if (group.type !== "carousel") continue;
    carouselsByStartIndex.set(group.partIndices[0], group);
    for (const index of group.partIndices) {
      carouselPartIndices.add(index);
    }
  }

  return { carouselsByStartIndex, carouselPartIndices };
}

type ToolishPart = {
  type?: string;
  toolName?: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: unknown;
  text?: string;
};

function toolNameOf(part: ToolishPart): string | null {
  if (typeof part.toolName === "string" && part.toolName.length > 0) {
    return part.toolName;
  }

  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.slice("tool-".length);
  }

  return null;
}

function tryRestaurantBlock(output: unknown): RestaurantCardBlock | null {
  const raw = extractGenUIBlockFromToolOutput(output);
  const parsed = safeParseGenUIBlock(raw);

  if (!parsed.ok || parsed.block.type !== "restaurant-card") return null;

  return parsed.block;
}

/**
 * Classify a single message part for restaurant grouping.
 * Pass `rendersChrome: true` when the part index hosts visible trail chrome
 * (activity trail start) even if the underlying tool would otherwise be transparent.
 */
export function classifyPartForRestaurantGrouping(
  part: unknown,
  options?: { rendersChrome?: boolean }
): RestaurantGroupingToken {
  if (options?.rendersChrome) {
    return { kind: "opaque" };
  }

  if (!part || typeof part !== "object") {
    return { kind: "transparent" };
  }

  const p = part as ToolishPart;

  if (p.type === "text") {
    return typeof p.text === "string" && p.text.trim().length > 0
      ? { kind: "opaque" }
      : { kind: "transparent" };
  }

  if (p.type === "reasoning") {
    return { kind: "transparent" };
  }

  const legacy =
    p.type === "tool-invocation" && typeof p.toolName === "string"
      ? (part as {
          type: "tool-invocation";
          toolName: string;
          state: string;
          result?: unknown;
          errorText?: unknown;
        })
      : null;

  if (legacy) {
    const name = legacy.toolName.toLowerCase();

    if (name === GATHER_RESTAURANT_TOOL_NAME) {
      if (legacy.state === "partial-call" || legacy.state === "call") {
        return { kind: "opaque" };
      }

      return { kind: "transparent" };
    }

    if (name === RENDER_GEN_UI_TOOL_NAME.toLowerCase()) {
      if (legacy.state === "result") {
        const block = tryRestaurantBlock(legacy.result);

        if (block) {
          return { kind: "restaurant", partIndex: -1, block };
        }
      }

      return { kind: "opaque" };
    }

    return { kind: "opaque" };
  }

  const toolName = toolNameOf(p);

  if (!toolName) {
    return { kind: "opaque" };
  }

  const name = toolName.toLowerCase();

  if (name === GATHER_RESTAURANT_TOOL_NAME) {
    if (p.state === "input-streaming" || p.state === "input-available") {
      return { kind: "opaque" };
    }

    return { kind: "transparent" };
  }

  if (name === RENDER_GEN_UI_TOOL_NAME.toLowerCase()) {
    if (p.state === "output-available") {
      const block = tryRestaurantBlock(p.output);

      if (block) {
        return { kind: "restaurant", partIndex: -1, block };
      }
    }

    return { kind: "opaque" };
  }

  return { kind: "opaque" };
}

/**
 * Build grouping tokens for an assistant message’s parts.
 * `trailStartIndices` marks parts that render activity-trail chrome (opaque).
 * `foldedIndices` are trail members that render null (transparent override).
 */
export function tokensForRestaurantGrouping(
  parts: readonly unknown[],
  options?: {
    trailStartIndices?: ReadonlySet<number>;
    foldedIndices?: ReadonlySet<number>;
  }
): RestaurantGroupingToken[] {
  const trailStarts = options?.trailStartIndices;
  const folded = options?.foldedIndices;

  return parts.map((part, partIndex) => {
    if (folded?.has(partIndex) && !trailStarts?.has(partIndex)) {
      return { kind: "transparent" };
    }

    const token = classifyPartForRestaurantGrouping(part, {
      rendersChrome: trailStarts?.has(partIndex) === true,
    });

    if (token.kind === "restaurant") {
      return { kind: "restaurant", partIndex, block: token.block };
    }

    return token;
  });
}

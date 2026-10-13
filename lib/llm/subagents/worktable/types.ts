import { z } from "zod";

/**
 * The orchestrator's worktable (COA-258): context bundles it composes for subagents and can send
 * again and again. Private to the orchestrator — a subagent only ever sees what a dispatch sends
 * it, frozen into its own thread. Not the shared append-only space deferred to COA-252.
 */
export const WORKTABLE_LIMITS = {
  bundles: 12,
  itemsPerBundle: 24,
  itemChars: 6_000,
  labelChars: 120,
  nameChars: 80,
  purposeChars: 400,
  instructionsChars: 4_000,
  /** Rendered context per dispatch — every bundle and inline item together. */
  dispatchContextChars: 40_000,
} as const;

export const WORKTABLE_ITEM_KINDS = [
  "note",
  "user_message",
  "subagent_output",
  "live_subagent_output",
  "memory",
] as const;

export type WorktableItemKind = (typeof WORKTABLE_ITEM_KINDS)[number];

const WorktableItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(WORKTABLE_ITEM_KINDS),
  label: z.string().nullable(),
  /** Frozen text. Empty for `live_subagent_output`, which resolves at each dispatch. */
  text: z.string(),
  /** The thread message the text was taken from (`user_message`, `subagent_output`). */
  sourceMessageId: z.string().nullable(),
  /** Whose output this is (`subagent_output`, `live_subagent_output`). */
  agentId: z.string().nullable(),
  addedAt: z.string(),
  updatedAt: z.string(),
});

export type WorktableItem = z.infer<typeof WorktableItemSchema>;

const ContextBundleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().nullable(),
  /** Standing instructions sent with every dispatch of this bundle (e.g. a review rubric). */
  instructions: z.string().nullable(),
  items: z.array(WorktableItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  sendCount: z.number().int().nonnegative(),
  lastSentAt: z.string().nullable(),
});

export type ContextBundle = z.infer<typeof ContextBundleSchema>;

export const WorktableSchema = z.object({
  version: z.literal(1),
  bundles: z.array(ContextBundleSchema),
  /** Dispatches made by automatic (heartbeat) turns since the user last spoke. */
  autonomousDispatches: z.number().int().nonnegative(),
});

export type Worktable = z.infer<typeof WorktableSchema>;

export function emptyWorktable(): Worktable {
  return { version: 1, bundles: [], autonomousDispatches: 0 };
}

/** Parse stored JSON; anything unreadable starts a fresh table rather than failing the turn. */
export function parseWorktable(value: unknown): Worktable {
  const parsed = WorktableSchema.safeParse(value);

  return parsed.success ? parsed.data : emptyWorktable();
}

/** What the model passes to add or attach an item. Resolved server-side before it is stored. */
export const WorktableItemInputSchema = z.object({
  kind: z
    .enum(WORKTABLE_ITEM_KINDS)
    .describe(
      "note: your own text. user_message: the user's words from this thread. subagent_output: one reply from a subagent's thread, frozen now. live_subagent_output: a subagent's latest reply, fetched fresh every time the bundle is sent. memory: a relevant saved memory."
    ),
  label: z
    .string()
    .max(WORKTABLE_LIMITS.labelChars)
    .optional()
    .describe("Short heading the subagent sees above this item."),
  text: z
    .string()
    .max(WORKTABLE_LIMITS.itemChars)
    .optional()
    .describe(
      "note/memory: the text. user_message: an exact quote from one of the user's messages in this thread; omit to use the latest user message in full."
    ),
  agentId: z
    .string()
    .max(128)
    .optional()
    .describe("subagent_output / live_subagent_output: the subagent's agentId or name."),
  messageId: z
    .string()
    .max(128)
    .optional()
    .describe(
      "subagent_output: a message id from read_subagent_thread; omit for its latest reply."
    ),
});

export type WorktableItemInput = z.infer<typeof WorktableItemInputSchema>;

/** An item after server-side resolution, before it gets an id and timestamps. */
export type ResolvedWorktableItem = Pick<
  WorktableItem,
  "kind" | "label" | "text" | "sourceMessageId" | "agentId"
>;

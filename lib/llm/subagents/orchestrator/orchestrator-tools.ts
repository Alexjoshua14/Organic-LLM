import type { ToolSet, UIMessage } from "ai";
import type {
  MultitaskStreamWriter,
  MultitaskTurnDeps,
  PrepareMultitaskTurnResult,
} from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";
import type { SubagentThreadRow } from "@/lib/llm/subagents/threads/snapshot";
import type { WorktableSession } from "@/lib/llm/subagents/worktable/session";
import type {
  BundleSelection,
  ContextBundle,
  ResolvedWorktableItem,
  WorktableItemInput,
} from "@/lib/llm/subagents/worktable/types";
import type {
  RabbitHoleNodeLike,
  ShorthandResolutionResult,
} from "@/lib/llm/subagents/worktable/shorthand";

import { createHash } from "crypto";

import { tool } from "ai";
import { z } from "zod";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import {
  pickRosterSlotForRole,
  resolveSubagentIdentity,
} from "@/lib/arcadia/multitask/subagent-identity";
import {
  ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES,
  ORCHESTRATOR_MAX_DISPATCHES_PER_TURN,
} from "@/lib/llm/subagents/orchestrator/constants";
import { createWorkerGoal } from "@/lib/llm/subagents/orchestrator/delegate";
import {
  createSubagentBudgetPolicy,
  selectSubagentModel,
  type SubagentBudgetPolicy,
  type SubagentPlanBudgetInput,
} from "@/lib/llm/subagents/orchestrator/cost-policy";
import { listRosterHardSetSubagents } from "@/lib/llm/subagents/hard-set/registry";
import { withReadSubagentThreadTool } from "@/lib/llm/subagents/orchestrator/read-subagent-thread-tool";
import { buildSubagentGoalMessage, uiMessageText } from "@/lib/llm/subagents/threads/messages";
import {
  CONTEXT_DATA_INSTRUCTIONS,
  createReadContextItemTool,
  readSubagentContext,
  selectContextExcerpt,
} from "@/lib/llm/subagents/threads/context-items";
import {
  estimateWorkerInput,
  selectWorkerHistory,
  workerModelMessages,
} from "@/lib/llm/subagents/worker/prepare-input";
import { SUBAGENT_THREAD_CONTEXT_MESSAGES } from "@/lib/llm/subagents/worker/cost-limits";
import { resolveEffectiveSubagentStatus } from "@/lib/llm/subagents/threads/status";
import { getWorkbenchManpage } from "@/lib/llm/subagents/worktable/manpages";
import {
  type WorktableOutcome,
  addBundleItems,
  createBundle,
  deleteBundle,
  findBundle,
  markBundlesSent,
  removeBundleItems,
  replaceBundleItem,
  reserveAutonomousDispatch,
  updateBundle,
} from "@/lib/llm/subagents/worktable/operations";
import {
  describeBundle,
  renderDispatchContext,
  selectDispatchBundles,
  summarizeBundle,
} from "@/lib/llm/subagents/worktable/render";
import { WORKTABLE_UNAVAILABLE_ERROR } from "@/lib/llm/subagents/worktable/session";
import { resolveShorthandRef } from "@/lib/llm/subagents/worktable/shorthand";
import {
  BundleSelectionSchema,
  WORKTABLE_LIMITS,
  WorktableItemInputSchema,
} from "@/lib/llm/subagents/worktable/types";

/** Orchestrator-thread messages searched when quoting the user. */
const USER_MESSAGE_LOOKBACK = 40;
/** Child-thread messages searched for a subagent's output. */
const SUBAGENT_OUTPUT_LOOKBACK = 40;
const BRIEF_MAX_CHARS = 8_000;

export type OrchestratorToolDeps = Pick<
  MultitaskTurnDeps,
  | "listChildren"
  | "loadMessages"
  | "ensureChild"
  | "appendMessages"
  | "setStatus"
  | "enqueueWorker"
  | "inspectWorkerInput"
>;

export type OrchestratorToolsInput = {
  orchestratorThreadId: string;
  deps: OrchestratorToolDeps;
  /** Null when worktable storage is unavailable; dispatch still works with inline items. */
  worktable: WorktableSession | null;
  /** The orchestrator's model; workers are selected separately by the cost policy. */
  modelId: string;
  zeroDataRetention: boolean;
  /** True on heartbeat-triggered turns, which dispatch under a tighter cap. */
  autonomous: boolean;
  /**
   * Automatic dispatches left before the user speaks again, from prepare. Enforced here when the
   * worktable (which otherwise holds the counter) is unavailable.
   */
  autonomousRemaining?: number | null;
  /** The message that opened this turn — it may not be saved yet when tools run. */
  currentUserMessage?: { id: string; text: string } | null;
  writer?: MultitaskStreamWriter;
  now?: () => number;
  /** Optional Rabbit Hole session graph nodes for `node:<nodeId>` shorthand expansion. */
  rabbitHoleNodes?: Record<string, RabbitHoleNodeLike> | null;
  rabbitHoleActiveNodeId?: string | null;
  rabbitHoleRootNodeId?: string | null;
  /** Optional plan budget snapshot or turn hard limit for self-managed USD gating. */
  planBudget?: SubagentPlanBudgetInput | null;
  hardLimitUsd?: number;
  /** Override max parallel dispatches per turn (defaults to 2 in Arcadia, 4 in Rabbit Hole). */
  maxDispatchesPerTurn?: number;
  /** Pre-created budget policy/ledger shared across the turn. */
  budgetLedger?: SubagentBudgetPolicy | null;
  budgetPolicy?: SubagentBudgetPolicy | null;
  /** Optional custom shorthand item resolver hook. */
  resolveShorthandItem?: (
    ref: string
  ) => Promise<ShorthandResolutionResult> | ShorthandResolutionResult;
  /** When true, always attach `read_subagent_thread` even before child threads exist. */
  alwaysIncludeReadSubagentThread?: boolean;
};

export type CreateOrchestratorToolsInput = OrchestratorToolsInput;

type Resolution<T> = { ok: true; value: T } | { ok: false; error: string };

function isSuccessfulDispatchPart(part: UIMessage["parts"][number]): boolean {
  if (part.type !== "tool-dispatch_subagent") return false;
  const { state, output } = part as {
    state?: string;
    output?: { success?: unknown; dryRun?: unknown };
  };

  return state === "output-available" && output?.success === true && output.dryRun !== true;
}

/**
 * Dispatches made by automatic turns since the user last spoke, read from the orchestrator's own
 * thread: every successful dispatch in a reply that follows a heartbeat notice (a `system` row).
 * The fallback counter when worktable storage is unavailable.
 */
export function countAutonomousDispatchesSinceUser(messages: ReadonlyArray<UIMessage>): number {
  let lastUser = -1;

  messages.forEach((m, i) => {
    if (m.role === "user") lastUser = i;
  });
  let afterHeartbeat = false;
  let count = 0;

  for (const message of messages.slice(lastUser + 1)) {
    if (message.role === "system") afterHeartbeat = true;
    else if (message.role === "assistant" && afterHeartbeat) {
      count += message.parts.filter(isSuccessfulDispatchPart).length;
    }
  }

  return count;
}

export const ORCHESTRATOR_TOOL_INSTRUCTIONS = [
  "Use dispatch_subagent only when the budget-first policy in [Orchestrator] warrants a specialist. Prefer one economy worker; additional parallel dispatches need additionalDispatchReason, and standard/frontier modelTier needs modelReason.",
  'Use worktable to keep reusable context bundles — create once, update single items, and send again. Call worktable({ action: "man", topic }) for detailed LLM manpages on shorthand, budget, rabbit_hole, or any specialist.',
  "Use shorthand references (node:<id>, out:<agentId>, msg:<id>, th:<threadId>, bundle:<id>) to bundle context without copying bulky text. Select only relevant bundle items and source excerpts. Use dryRun to inspect complete input and USD budget sizing.",
].join(" ");

export const WorktableActionSchema = z.enum([
  "man",
  "list",
  "view",
  "create",
  "update",
  "add_items",
  "update_item",
  "remove_items",
  "delete",
]);

const WorktableToolInputSchema = z.object({
  action: WorktableActionSchema.describe(
    "What to do on the worktable. Use 'man' to read LLM workbench manpages."
  ),
  topic: z
    .string()
    .max(64)
    .optional()
    .describe(
      "man: topic to read (overview, worktable, dispatch_subagent, budget, shorthand, rabbit_hole, lyra, reed, archer, mira, cass, vesper)."
    ),
  bundle: z
    .string()
    .max(128)
    .optional()
    .describe("Bundle id or name. Required for every action except man, list, and create."),
  name: z
    .string()
    .max(WORKTABLE_LIMITS.nameChars)
    .optional()
    .describe("create: the bundle's name. update: a new name."),
  purpose: z
    .string()
    .max(WORKTABLE_LIMITS.purposeChars)
    .optional()
    .describe("create/update: when to use this bundle and who it is for."),
  instructions: z
    .string()
    .max(WORKTABLE_LIMITS.instructionsChars)
    .optional()
    .describe("create/update: standing instructions sent every time, e.g. a review rubric."),
  items: z
    .array(WorktableItemInputSchema)
    .max(WORKTABLE_LIMITS.itemsPerBundle)
    .optional()
    .describe("create/add_items: items to add. update_item: exactly one replacement item."),
  shorthand: z
    .array(z.string().max(128))
    .max(WORKTABLE_LIMITS.itemsPerBundle)
    .optional()
    .describe(
      "create/add_items: shorthand refs to expand into items (node:<id>, out:<agentId>, msg:<id>, th:<threadId>)."
    ),
  itemIds: z
    .array(z.string().max(32))
    .max(WORKTABLE_LIMITS.itemsPerBundle)
    .optional()
    .describe("update_item: the one item to replace. remove_items: the items to remove."),
});

const DispatchToolInputSchema = z.object({
  agent: z
    .string()
    .min(1)
    .max(128)
    .describe(
      "Who gets the work: an agentId, name, or role from the roster (e.g. agent-coder, Reed, coder)."
    ),
  brief: z
    .string()
    .min(1)
    .max(BRIEF_MAX_CHARS)
    .describe(
      "The assignment in your own words, standing alone: the task, why it matters, constraints, the deliverable, and when it is done."
    ),
  modelTier: z
    .enum(["micro", "economy", "standard", "frontier"])
    .optional()
    .describe(
      "Default economy. Micro for fast triage; standard or frontier only when the assignment needs stronger reasoning and budget permits; never inherits the orchestrator's model."
    ),
  modelReason: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Required for standard and frontier: why this task cannot be done well by a cheaper worker (at least 20 characters)."
    ),
  additionalDispatchReason: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Required after the first dispatch this turn: the independent work another specialist adds (at least 20 characters)."
    ),
  bundles: z
    .array(BundleSelectionSchema)
    .max(WORKTABLE_LIMITS.bundles)
    .optional()
    .describe(
      "Whole bundle ids/names, or {bundle, items:[{itemId,offset?,limit?}], includeInstructions?}. Prefer selected items; omitted items sends all, [] sends instructions only."
    ),
  shorthand: z
    .array(z.string().max(128))
    .max(WORKTABLE_LIMITS.itemsPerBundle)
    .optional()
    .describe(
      "Compact shorthand refs for this dispatch (node:<id>, out:<agentId>, msg:<id>, th:<threadId>, bundle:<id>)."
    ),
  history: z
    .enum(["continue", "fresh"])
    .optional()
    .describe(
      "Default continue preserves prior input/cache prefix. Fresh sends only this new assignment."
    ),
  historyMessageIds: z
    .array(z.string().min(1).max(128))
    .max(SUBAGENT_THREAD_CONTEXT_MESSAGES)
    .optional()
    .describe(
      "Explicit own-thread history IDs from read_subagent_thread; excludes other history. [] keeps none."
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      "Inspect selection and complete token/cost estimates without saving or queueing an assignment."
    ),
  items: z
    .array(WorktableItemInputSchema)
    .max(WORKTABLE_LIMITS.itemsPerBundle)
    .optional()
    .describe("One-off context for this dispatch only; not saved to the worktable."),
});

function normalizeQuote(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
}

function lastReply(messages: ReadonlyArray<UIMessage>): { text: string; messageId: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;

    if (message.role !== "assistant") continue;
    const text = uiMessageText(message, false);

    if (text.trim()) return { text, messageId: message.id };
  }

  return null;
}

function matchesAgent(agentId: string, wanted: string): boolean {
  return (
    agentId.toLowerCase() === wanted ||
    resolveSubagentIdentity(agentId).name.toLowerCase() === wanted
  );
}

/**
 * Who a dispatch may target: an existing child of this orchestrator, a roster slot or a locked
 * hard-set subagent by id or name, or either by role. Never a worker id the model made up.
 */
export function resolveDispatchTarget(
  agent: string,
  children: ReadonlyArray<SubagentThreadRow>
): string | null {
  const wanted = agent.trim().replace(/^@/, "").toLowerCase();

  if (!wanted) return null;
  const child = children.find((c) => matchesAgent(c.agentId, wanted));

  if (child) return child.agentId;
  const slot = createDemoSubagents().find((s) => matchesAgent(s.id, wanted));

  if (slot) return slot.id;
  const locked = listRosterHardSetSubagents();
  const lockedByName = locked.find(
    (a) => a.id.toLowerCase() === wanted || a.name.toLowerCase() === wanted
  );

  if (lockedByName) return lockedByName.rosterSlotId ?? lockedByName.id;
  const busy = new Set(children.filter((c) => c.status === "working").map((c) => c.agentId));

  return (
    pickRosterSlotForRole(wanted, { busyAgentIds: busy }) ??
    pickRosterSlotForRole(wanted) ??
    locked.find((a) => a.role.toLowerCase() === wanted)?.rosterSlotId ??
    locked.find((a) => a.role.toLowerCase() === wanted)?.id ??
    null
  );
}

/**
 * `worktable` and `dispatch_subagent` for an Arcadia or Rabbit Hole orchestrator turn. References
 * resolve only inside this orchestrator's own thread, its children, and its active Rabbit Hole graph.
 */
export function createOrchestratorTools(input: OrchestratorToolsInput): ToolSet {
  const { deps, orchestratorThreadId } = input;
  const now = input.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  const maxDispatchesPerTurn =
    input.maxDispatchesPerTurn ??
    input.budgetLedger?.maxParallelDispatches ??
    input.budgetPolicy?.maxParallelDispatches ??
    ORCHESTRATOR_MAX_DISPATCHES_PER_TURN;
  const budgetLedger =
    input.budgetLedger ??
    input.budgetPolicy ??
    createSubagentBudgetPolicy({
      planBudget: input.planBudget,
      hardLimitUsd: input.hardLimitUsd,
      maxParallelDispatches: maxDispatchesPerTurn,
      zeroDataRetention: input.zeroDataRetention,
    });

  let dispatchesThisTurn = 0;
  let autonomousLeft = Math.min(
    input.autonomousRemaining ?? 0,
    ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES
  );
  let dispatchQueue: Promise<unknown> = Promise.resolve();
  const dispatchedAgents = new Set<string>();
  const dispatchedWork = new Set<string>();

  const listChildren = () => deps.listChildren(orchestratorThreadId);

  const findChild = async (agent: string) => {
    const wanted = agent.trim().replace(/^@/, "").toLowerCase();

    return (await listChildren()).find((c) => matchesAgent(c.agentId, wanted));
  };

  const resolveLive = async (agentId: string) => {
    const child = await findChild(agentId);

    return child
      ? lastReply(await deps.loadMessages(child.threadId, SUBAGENT_OUTPUT_LOOKBACK))
      : null;
  };

  const resolveShorthandList = async (
    refs: ReadonlyArray<string> | undefined
  ): Promise<
    Resolution<{
      items: ResolvedWorktableItem[];
      bundles: string[];
    }>
  > => {
    if (!refs || refs.length === 0) {
      return { ok: true, value: { items: [], bundles: [] } };
    }

    const needsChildren = refs.some((r) => /^(out|th):/i.test(r.trim()));
    const needsMessages = refs.some((r) => /^msg:/i.test(r.trim()));
    const children = needsChildren ? await listChildren() : [];
    let messages: Array<UIMessage | { id: string; role: string; text: string }> = [];

    if (needsMessages) {
      const loaded = await deps.loadMessages(orchestratorThreadId, USER_MESSAGE_LOOKBACK);

      messages = [...loaded];
      if (
        input.currentUserMessage?.text.trim() &&
        !messages.some((m) => m.id === input.currentUserMessage!.id)
      ) {
        messages.push({
          id: input.currentUserMessage.id,
          role: "user",
          text: input.currentUserMessage.text,
        });
      }
    }

    const resolvedItems: ResolvedWorktableItem[] = [];
    const resolvedBundles: string[] = [];

    for (const ref of refs) {
      const outcome = input.resolveShorthandItem
        ? await input.resolveShorthandItem(ref)
        : resolveShorthandRef(ref, {
            nodesById: input.rabbitHoleNodes,
            activeNodeId: input.rabbitHoleActiveNodeId,
            rootNodeId: input.rabbitHoleRootNodeId,
            children,
            messages,
            resolveAgentId: (agent) => resolveDispatchTarget(agent, children),
          });

      if (!outcome.ok) {
        return { ok: false, error: outcome.error };
      }
      if (outcome.kind === "bundle") {
        if (!resolvedBundles.includes(outcome.bundle)) {
          resolvedBundles.push(outcome.bundle);
        }
      } else {
        resolvedItems.push(outcome.item);
      }
    }

    return { ok: true, value: { items: resolvedItems, bundles: resolvedBundles } };
  };

  const resolveItem = async (
    item: WorktableItemInput
  ): Promise<Resolution<ResolvedWorktableItem>> => {
    const label = item.label?.trim() || null;
    const base = { kind: item.kind, label, sourceMessageId: null, agentId: null };
    const attach = (text: string, fields: Partial<ResolvedWorktableItem> = {}) => ({
      ok: true as const,
      value: { ...base, ...fields, ...selectContextExcerpt(text, item) },
    });

    if (item.kind === "note" || item.kind === "memory") {
      const text = item.text;

      return text?.trim() ? attach(text) : { ok: false, error: `A ${item.kind} item needs text.` };
    }

    if (item.kind === "user_message") {
      const recent = await deps.loadMessages(orchestratorThreadId, USER_MESSAGE_LOOKBACK);
      const pool = recent
        .filter((m) => m.role === "user")
        .map((m) => ({ id: m.id, text: uiMessageText(m, false) }))
        .filter((m) => m.text);
      const current = input.currentUserMessage;

      if (current?.text.trim() && !pool.some((m) => m.id === current.id)) pool.push(current);
      const quote = item.text;
      const sources = item.messageId ? pool.filter((m) => m.id === item.messageId) : pool;

      if (!quote?.trim()) {
        const latest = sources.at(-1);

        return latest
          ? attach(latest.text, { sourceMessageId: latest.id })
          : { ok: false, error: "There is no user message in this thread to attach." };
      }

      const wanted = normalizeQuote(quote);
      const source = [...sources].reverse().find((m) => normalizeQuote(m.text).includes(wanted));

      return source
        ? attach(quote, { sourceMessageId: source.id })
        : {
            ok: false,
            error:
              "That quote is not in the user's recent messages. Quote their exact words, omit text to attach their latest message, or use a note for your own paraphrase.",
          };
    }

    const agent = item.agentId?.trim();

    if (!agent) return { ok: false, error: `A ${item.kind} item needs an agentId.` };

    if (item.kind === "live_subagent_output") {
      const agentId = resolveDispatchTarget(agent, await listChildren());

      return agentId
        ? {
            ok: true,
            value: {
              ...base,
              text: "",
              agentId,
              sourceOffset: item.offset,
              sourceLimit: item.limit,
            },
          }
        : { ok: false, error: `No subagent "${agent}" on the roster.` };
    }

    const child = await findChild(agent);

    if (!child)
      return { ok: false, error: `"${agent}" has no thread under this orchestrator yet.` };
    const messages = await deps.loadMessages(child.threadId, SUBAGENT_OUTPUT_LOOKBACK);
    const picked = item.messageId
      ? messages.find((m) => m.id === item.messageId)
      : [...messages].reverse().find((m) => m.role === "assistant" && uiMessageText(m));
    const text = picked ? uiMessageText(picked, false) : "";

    if (!picked || !text) {
      return {
        ok: false,
        error: item.messageId
          ? `Message ${item.messageId} is not in ${resolveSubagentIdentity(child.agentId).name}'s recent thread.`
          : `${resolveSubagentIdentity(child.agentId).name} has no output yet. Use live_subagent_output to send whatever it produces next.`,
      };
    }

    return attach(text, { sourceMessageId: picked.id, agentId: child.agentId });
  };

  const resolveItems = async (
    items: ReadonlyArray<WorktableItemInput> | undefined
  ): Promise<Resolution<ResolvedWorktableItem[]>> => {
    const resolved: ResolvedWorktableItem[] = [];

    for (const [index, item] of (items ?? []).entries()) {
      let result: Resolution<ResolvedWorktableItem>;

      try {
        result = await resolveItem(item);
      } catch (error) {
        return {
          ok: false,
          error: `Item ${index + 1}: ${error instanceof Error ? error.message : "Context selection failed."}`,
        };
      }

      if (!result.ok) return { ok: false, error: `Item ${index + 1}: ${result.error}` };
      resolved.push(result.value);
    }

    return { ok: true, value: resolved };
  };

  const worktable = tool({
    description:
      "Your private worktable of reusable context bundles for subagents, plus 'man' to read LLM workbench manpages. List, view, create, update, or delete bundles, and add, replace, or remove single items. Bundles are only sent when you pass them to dispatch_subagent.",
    inputSchema: WorktableToolInputSchema,
    execute: async (
      args: z.infer<typeof WorktableToolInputSchema> & { shorthandRefs?: string[] }
    ) => {
      if (args.action === "man") {
        const page = getWorkbenchManpage(args.topic);

        return {
          success: true,
          ok: true,
          topic: page.topic,
          known: page.known,
          manpage: page.manpage,
          availableTopics: page.availableTopics,
        };
      }

      const session = input.worktable;

      if (!session) return { success: false, error: WORKTABLE_UNAVAILABLE_ERROR };

      if (args.action === "list" || args.action === "view") {
        const table = await session.read();

        if (!table) return { success: false, error: WORKTABLE_UNAVAILABLE_ERROR };
        if (args.action === "list") {
          return { success: true, bundles: table.bundles.map(summarizeBundle) };
        }
        const bundle = args.bundle ? findBundle(table, args.bundle) : undefined;

        return bundle
          ? { success: true, bundle: describeBundle(bundle) }
          : { success: false, error: `No bundle "${args.bundle ?? ""}" on the worktable.` };
      }

      if (args.action !== "create" && !args.bundle) {
        return { success: false, error: `${args.action} needs a bundle id or name.` };
      }
      const ref = args.bundle ?? "";
      const items = await resolveItems(args.items);

      if (!items.ok) return { success: false, error: items.error };
      const shorthandTokens = [...(args.shorthand ?? []), ...(args.shorthandRefs ?? [])];
      const expandedShorthand = await resolveShorthandList(shorthandTokens);

      if (!expandedShorthand.ok) {
        return { success: false, error: expandedShorthand.error };
      }
      const combinedItems = [...items.value, ...expandedShorthand.value.items];
      const at = iso();

      const outcome = await session.mutate((table): WorktableOutcome<ContextBundle> => {
        switch (args.action) {
          case "create":
            return createBundle(
              table,
              {
                name: args.name ?? "",
                purpose: args.purpose,
                instructions: args.instructions,
                items: combinedItems,
              },
              at
            );
          case "update":
            return updateBundle(
              table,
              ref,
              { name: args.name, purpose: args.purpose, instructions: args.instructions },
              at
            );
          case "add_items":
            return combinedItems.length > 0
              ? addBundleItems(table, ref, combinedItems, at)
              : { ok: false, error: "add_items needs items." };
          case "update_item":
            return args.itemIds?.length === 1 && combinedItems.length === 1
              ? replaceBundleItem(table, ref, args.itemIds[0]!, combinedItems[0]!, at)
              : {
                  ok: false,
                  error: "update_item needs exactly one itemId and one replacement item.",
                };
          case "remove_items":
            return args.itemIds?.length
              ? removeBundleItems(table, ref, args.itemIds, at)
              : { ok: false, error: "remove_items needs itemIds." };
          case "delete":
            return deleteBundle(table, ref);
          default:
            return { ok: false, error: `Unknown action ${args.action}.` };
        }
      });

      if (!outcome.ok) return { success: false, error: outcome.error };

      return args.action === "delete"
        ? { success: true, deleted: outcome.value.name }
        : { success: true, bundle: describeBundle(outcome.value) };
    },
  });

  const runDispatch = async (
    args: z.infer<typeof DispatchToolInputSchema> & { shorthandRefs?: string[] }
  ) => {
    if (dispatchesThisTurn >= maxDispatchesPerTurn) {
      return {
        success: false,
        ok: false,
        error: `You can dispatch at most ${maxDispatchesPerTurn} times per turn. Tell the user what is queued next.`,
      };
    }
    if (dispatchesThisTurn > 0 && (args.additionalDispatchReason?.trim().length ?? 0) < 20) {
      return {
        success: false,
        ok: false,
        error:
          "One specialist is the default. A second dispatch needs additionalDispatchReason explaining the independent work it adds (at least 20 characters).",
      };
    }
    const selection = selectSubagentModel({
      tier: args.modelTier,
      reason: args.modelReason,
      zeroDataRetention: input.zeroDataRetention,
    });

    if (!selection.ok) return { success: false, ok: false, error: selection.error };

    const brief = args.brief.trim();

    if (!brief) return { success: false, ok: false, error: "The brief is empty." };
    const children = await listChildren();
    const agentId = resolveDispatchTarget(args.agent, children);

    if (!agentId) {
      return {
        success: false,
        ok: false,
        error: `No subagent "${args.agent}" on the roster. Use an agentId, name, or role from [Orchestrator].`,
      };
    }
    const existing = children.find((c) => c.agentId === agentId);

    if (
      dispatchedAgents.has(agentId) ||
      (existing &&
        resolveEffectiveSubagentStatus(existing.status, existing.statusAt, now()) === "working")
    ) {
      return {
        success: false,
        ok: false,
        agentId,
        error: `${resolveSubagentIdentity(agentId).name} already has work in flight. Wait for its result; no additional assignment was queued.`,
      };
    }

    const shorthandTokens = [...(args.shorthand ?? []), ...(args.shorthandRefs ?? [])];
    const expandedShorthand = await resolveShorthandList(shorthandTokens);

    if (!expandedShorthand.ok) {
      return { success: false, ok: false, error: expandedShorthand.error };
    }

    const bundleSelections: BundleSelection[] = [
      ...(args.bundles ?? []),
      ...expandedShorthand.value.bundles,
    ];
    let bundles: ContextBundle[] = [];
    let omittedBundleItems = 0;

    if (bundleSelections.length) {
      const table = input.worktable ? await input.worktable.read() : null;

      if (!table) return { success: false, ok: false, error: WORKTABLE_UNAVAILABLE_ERROR };
      try {
        const selected = selectDispatchBundles(table, bundleSelections);

        bundles = selected.bundles;
        omittedBundleItems = selected.omittedItems;
      } catch (error) {
        return {
          success: false,
          ok: false,
          error: error instanceof Error ? error.message : "Bundle selection failed.",
        };
      }
    }

    const items = await resolveItems(args.items);

    if (!items.ok) return { success: false, ok: false, error: items.error };
    const combinedItems = [...items.value, ...expandedShorthand.value.items];
    let rendered: Awaited<ReturnType<typeof renderDispatchContext>>;

    try {
      rendered = await renderDispatchContext({ bundles, items: combinedItems, resolveLive });
    } catch (error) {
      return {
        success: false,
        ok: false,
        error: error instanceof Error ? error.message : "Context rendering failed.",
      };
    }
    const { context } = rendered;

    if (context.length > WORKTABLE_LIMITS.dispatchContextChars) {
      return {
        success: false,
        ok: false,
        error: `That context is ${context.length} characters; the limit per dispatch is ${WORKTABLE_LIMITS.dispatchContextChars}. Send fewer bundles or trim items.`,
      };
    }
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          brief,
          bundles.map((bundle) => [bundle.name, bundle.instructions]),
          rendered.items.map(({ itemId: _id, ...item }) => item),
        ])
      )
      .digest("hex");

    if (dispatchedWork.has(fingerprint)) {
      return {
        success: false,
        ok: false,
        error:
          "This work was already dispatched this turn. Reuse its result instead of sending it to another specialist.",
      };
    }

    const goal = createWorkerGoal({
      orchestratorId: orchestratorThreadId,
      workerAgentId: agentId,
      goal: brief,
      now: now(),
    });
    let selectedHistory: ReturnType<typeof selectWorkerHistory>;

    try {
      selectedHistory = selectWorkerHistory(
        existing
          ? await deps.loadMessages(existing.threadId, SUBAGENT_THREAD_CONTEXT_MESSAGES)
          : [],
        args.history,
        args.historyMessageIds
      );
    } catch (error) {
      return {
        success: false,
        ok: false,
        error: error instanceof Error ? error.message : "History selection failed.",
      };
    }
    const assignment = buildSubagentGoalMessage({
      goal: brief,
      goalId: goal.goalId,
      id: goal.goalId,
      modelId: selection.modelId,
      modelTier: selection.tier,
      modelReason: args.modelReason?.trim(),
      context,
      bundles: bundles.map((bundle) => ({ id: bundle.id, name: bundle.name })),
      subagentContext: { version: 1, items: rendered.items, history: selectedHistory.selection },
    });

    const inspectFn =
      deps.inspectWorkerInput ??
      (async (req) =>
        estimateWorkerInput({
          instructions: "worker",
          toolSchemaText: "[]",
          messages: await workerModelMessages(req.history, req.assignment),
          modelId: req.modelId,
        }));
    let inspection: Awaited<ReturnType<NonNullable<OrchestratorToolDeps["inspectWorkerInput"]>>>;

    try {
      inspection = await inspectFn({
        assignment,
        history: selectedHistory.messages,
        threadId: existing?.threadId ?? goal.goalId,
        agentId,
        modelId: selection.modelId,
      });
    } catch {
      return {
        success: false,
        ok: false,
        error: "Could not inspect worker input; nothing was queued.",
      };
    }
    const manifest = {
      items: rendered.manifest,
      omittedBundleItems,
      history: selectedHistory.selection,
      budget: inspection.budget,
    };

    const budgetCheck = budgetLedger.checkDispatch({
      tier: selection.tier,
      modelId: selection.modelId,
      estimatedInputTokens: inspection.budget.estimatedInputTokens,
    });
    const budgetReport = {
      estimatedCostUsd: budgetCheck.estimatedCostUsd,
      turnEstimatedSpendUsd: budgetCheck.turnEstimatedSpendUsd,
      hardLimitUsd: budgetCheck.hardLimitUsd,
      remainingUsd: budgetCheck.remainingUsd,
      zeroDataRetention: input.zeroDataRetention,
    };

    if (!budgetCheck.ok) {
      return {
        success: false,
        ok: false,
        agentId,
        modelId: selection.modelId,
        modelTier: selection.tier,
        manifest,
        budget: budgetReport,
        suggestedTier: budgetCheck.suggestedTier,
        error: budgetCheck.error,
      };
    }

    if (!inspection.fits)
      return {
        success: false,
        ok: false,
        manifest,
        budget: budgetReport,
        error:
          "Selected worker input exceeds its budget including tools, instructions, retained history, and tool-result headroom. Select fewer items/excerpts or use fresh/historyMessageIds; required content must stay intact.",
      };
    if (args.dryRun)
      return {
        success: true,
        ok: true,
        dryRun: true,
        agentId,
        modelId: selection.modelId,
        modelTier: selection.tier,
        manifest,
        budget: budgetReport,
      };

    if (input.autonomous) {
      if (input.worktable) {
        const reserved = await input.worktable.mutate((table) =>
          reserveAutonomousDispatch(table, ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES)
        );

        if (!reserved.ok) return { success: false, ok: false, error: reserved.error };
      } else {
        if (autonomousLeft <= 0) {
          return {
            success: false,
            ok: false,
            error: `Automatic turns may dispatch at most ${ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES} times until the user speaks again. Tell the user what you would send next instead.`,
          };
        }
        autonomousLeft -= 1;
      }
    }

    const identity = resolveSubagentIdentity(agentId);
    const threadId =
      existing?.threadId ??
      (await deps.ensureChild({
        parentThreadId: orchestratorThreadId,
        agentId,
        title: `${identity.name} · ${identity.role}`,
      }));

    if (!threadId) {
      return {
        success: false,
        ok: false,
        error:
          "Subagent storage is unavailable, so nothing was sent. Do the work here or tell the user.",
      };
    }

    const saved = await deps.appendMessages(threadId, [assignment]);

    if (!saved)
      return {
        success: false,
        ok: false,
        error: "Could not save the assignment, so nothing was sent.",
      };
    await deps.setStatus(threadId, "working");
    await deps.enqueueWorker({
      goal,
      threadId,
      modelId: selection.modelId,
      zeroDataRetention: input.zeroDataRetention,
    });
    dispatchesThisTurn += 1;
    dispatchedAgents.add(agentId);
    dispatchedWork.add(fingerprint);
    const recordedBudget = budgetLedger.recordDispatch(budgetCheck.estimatedCostUsd);

    if (bundles.length > 0) {
      const at = iso();

      await input.worktable?.mutate((table) => ({
        ok: true as const,
        worktable: markBundlesSent(
          table,
          bundles.map((b) => b.id),
          at
        ),
        value: null,
      }));
    }

    input.writer?.write({
      type: "data-multitask-routing",
      data: {
        sendTarget: { kind: "orchestrator" },
        mode: "routed",
        assignedGoals: [{ goalId: goal.goalId, agentId, goal: brief, threadId }],
        directThoughts: [],
      },
      transient: true,
    });

    return {
      success: true,
      ok: true,
      agentId,
      name: identity.name,
      role: identity.role,
      threadId,
      goalId: goal.goalId,
      modelId: selection.modelId,
      modelTier: selection.tier,
      bundlesSent: bundles.map((b) => b.name),
      contextItems: bundles.reduce((n, b) => n + b.items.length, 0) + combinedItems.length,
      contextChars: context.length,
      manifest,
      budget: {
        estimatedCostUsd: budgetCheck.estimatedCostUsd,
        turnEstimatedSpendUsd: recordedBudget.turnSpentEstimatedUsd,
        hardLimitUsd: recordedBudget.hardLimitUsd,
        remainingUsd: recordedBudget.remainingUsd,
        zeroDataRetention: input.zeroDataRetention,
      },
    };
  };

  const dispatch_subagent = tool({
    description:
      "Send necessary work to one idle specialist under the budget-first policy. Defaults to an economy model (or micro/standard/frontier with budget check). Additional dispatches need a reason for independent work; standard and frontier tiers need a model justification. Supports shorthand context refs (node:<id>, out:<agentId>, msg:<id>, bundle:<id>). Returns immediately.",
    inputSchema: DispatchToolInputSchema,
    // One at a time: parallel calls in a step must not overrun the caps or race a child thread.
    execute: (args) => {
      const next = dispatchQueue.then(() => runDispatch(args));

      dispatchQueue = next.catch(() => undefined);

      return next;
    },
  });

  return { worktable, dispatch_subagent };
}

/**
 * Merge an Arcadia or Rabbit Hole orchestrator's own tools into a compiled toolset:
 * `read_subagent_thread` once it has subagent threads (or when `alwaysIncludeReadSubagentThread` is set),
 * and `worktable` + `dispatch_subagent` whenever it writes its own dispatches.
 */
export function withArcadiaOrchestratorTools(
  compiled: { tools: ToolSet; toolInstructions: string },
  args: Omit<OrchestratorToolsInput, "worktable"> & { multitask: PrepareMultitaskTurnResult | null }
): { tools: ToolSet; toolInstructions: string } {
  const { multitask, ...toolsInput } = args;

  if (multitask?.role === "subagent" && multitask.parentThreadId) {
    let items: Promise<NonNullable<ReturnType<typeof readSubagentContext>>["items"]> | undefined;
    const reader = createReadContextItemTool(() => {
      items ??= toolsInput.deps
        .loadMessages(toolsInput.orchestratorThreadId, SUBAGENT_THREAD_CONTEXT_MESSAGES)
        .then((messages) => {
          const assignment = [...messages]
            .reverse()
            .find(
              (message) =>
                message.role === "user" &&
                (message.metadata as { source?: string } | undefined)?.source === "orchestrator"
            );

          return assignment ? (readSubagentContext(assignment)?.items ?? []) : [];
        });

      return items;
    });

    return {
      tools: { ...compiled.tools, read_context_item: reader },
      toolInstructions: [compiled.toolInstructions, CONTEXT_DATA_INSTRUCTIONS]
        .filter(Boolean)
        .join("\n\n"),
    };
  }
  if (multitask?.role !== "orchestrator") return compiled;
  let next = compiled;

  if (
    (multitask.hasSubagentThreads || toolsInput.alwaysIncludeReadSubagentThread) &&
    !next.tools.read_subagent_thread
  ) {
    next = withReadSubagentThreadTool(next, {
      orchestratorThreadId: toolsInput.orchestratorThreadId,
      deps: toolsInput.deps,
    });
  }
  if (multitask.orchestratorDispatch && !next.tools.dispatch_subagent) {
    next = {
      tools: {
        ...next.tools,
        ...createOrchestratorTools({
          ...toolsInput,
          worktable: multitask.worktable,
          autonomousRemaining: multitask.autonomousRemaining,
        }),
      },
      toolInstructions: [next.toolInstructions, ORCHESTRATOR_TOOL_INSTRUCTIONS]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return next;
}

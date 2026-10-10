import type { ToolSet, UIMessage } from "ai";
import type {
  MultitaskStreamWriter,
  MultitaskTurnDeps,
  PrepareMultitaskTurnResult,
} from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";
import type { SubagentThreadRow } from "@/lib/llm/subagents/threads/snapshot";
import type { WorktableSession } from "@/lib/llm/subagents/worktable/session";
import type {
  ContextBundle,
  ResolvedWorktableItem,
  WorktableItemInput,
} from "@/lib/llm/subagents/worktable/types";

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
import { withReadSubagentThreadTool } from "@/lib/llm/subagents/orchestrator/read-subagent-thread-tool";
import { buildSubagentGoalMessage, uiMessageText } from "@/lib/llm/subagents/threads/messages";
import { resolveEffectiveSubagentStatus } from "@/lib/llm/subagents/threads/status";
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
  summarizeBundle,
} from "@/lib/llm/subagents/worktable/render";
import { WORKTABLE_UNAVAILABLE_ERROR } from "@/lib/llm/subagents/worktable/session";
import { WORKTABLE_LIMITS, WorktableItemInputSchema } from "@/lib/llm/subagents/worktable/types";

/** Orchestrator-thread messages searched when quoting the user. */
const USER_MESSAGE_LOOKBACK = 40;
/** Child-thread messages searched for a subagent's output. */
const SUBAGENT_OUTPUT_LOOKBACK = 40;
const BRIEF_MAX_CHARS = 8_000;

export type OrchestratorToolDeps = Pick<
  MultitaskTurnDeps,
  "listChildren" | "loadMessages" | "ensureChild" | "appendMessages" | "setStatus" | "enqueueWorker"
>;

export type OrchestratorToolsInput = {
  orchestratorThreadId: string;
  deps: OrchestratorToolDeps;
  /** Null when worktable storage is unavailable; dispatch still works with inline items. */
  worktable: WorktableSession | null;
  /** Model the subagent runs on (the turn's chat model). */
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
};

type Resolution<T> = { ok: true; value: T } | { ok: false; error: string };

function isSuccessfulDispatchPart(part: UIMessage["parts"][number]): boolean {
  if (part.type !== "tool-dispatch_subagent") return false;
  const { state, output } = part as { state?: string; output?: { success?: unknown } };

  return state === "output-available" && output?.success === true;
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
  "Use dispatch_subagent to give a subagent work: a self-contained brief in your own words, plus the context it needs as worktable bundles or inline items.",
  "Use worktable to keep reusable context bundles — create once, update single items, and send again.",
].join(" ");

const WorktableToolInputSchema = z.object({
  action: z
    .enum([
      "list",
      "view",
      "create",
      "update",
      "add_items",
      "update_item",
      "remove_items",
      "delete",
    ])
    .describe("What to do on the worktable."),
  bundle: z
    .string()
    .max(128)
    .optional()
    .describe("Bundle id or name. Required for every action except list and create."),
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
  bundles: z
    .array(z.string().max(128))
    .max(WORKTABLE_LIMITS.bundles)
    .optional()
    .describe("Worktable bundle ids or names to send with the brief."),
  items: z
    .array(WorktableItemInputSchema)
    .max(WORKTABLE_LIMITS.itemsPerBundle)
    .optional()
    .describe("One-off context for this dispatch only; not saved to the worktable."),
});

function normalizeQuote(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
}

function clampItemText(text: string): string {
  const trimmed = text.trim();

  return trimmed.length > WORKTABLE_LIMITS.itemChars
    ? `${trimmed.slice(0, WORKTABLE_LIMITS.itemChars - 16)}\n…(truncated)`
    : trimmed;
}

function lastReply(messages: ReadonlyArray<UIMessage>): { text: string; messageId: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;

    if (message.role !== "assistant") continue;
    const text = uiMessageText(message);

    if (text) return { text: clampItemText(text), messageId: message.id };
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
 * Who a dispatch may target: an existing child of this orchestrator, a roster slot by id or
 * name, or a roster slot by role. Never a worker id the model made up.
 */
export function resolveDispatchTarget(
  agent: string,
  children: ReadonlyArray<SubagentThreadRow>
): string | null {
  const wanted = agent.trim().toLowerCase();

  if (!wanted) return null;
  const child = children.find((c) => matchesAgent(c.agentId, wanted));

  if (child) return child.agentId;
  const slot = createDemoSubagents().find((s) => matchesAgent(s.id, wanted));

  if (slot) return slot.id;
  const busy = new Set(children.filter((c) => c.status === "working").map((c) => c.agentId));

  return pickRosterSlotForRole(wanted, { busyAgentIds: busy }) ?? pickRosterSlotForRole(wanted);
}

/**
 * `worktable` and `dispatch_subagent` for an Arcadia orchestrator turn (COA-258). References
 * resolve only inside this orchestrator's own thread and its children.
 */
export function createOrchestratorTools(input: OrchestratorToolsInput): ToolSet {
  const { deps, orchestratorThreadId } = input;
  const now = input.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  let dispatchesThisTurn = 0;
  let autonomousLeft = input.autonomousRemaining ?? 0;
  let dispatchQueue: Promise<unknown> = Promise.resolve();

  const listChildren = () => deps.listChildren(orchestratorThreadId);

  const findChild = async (agent: string) => {
    const wanted = agent.trim().toLowerCase();

    return (await listChildren()).find((c) => matchesAgent(c.agentId, wanted));
  };

  const resolveLive = async (agentId: string) => {
    const child = await findChild(agentId);

    return child
      ? lastReply(await deps.loadMessages(child.threadId, SUBAGENT_OUTPUT_LOOKBACK))
      : null;
  };

  const resolveItem = async (
    item: WorktableItemInput
  ): Promise<Resolution<ResolvedWorktableItem>> => {
    const label = item.label?.trim() || null;
    const base = { kind: item.kind, label, sourceMessageId: null, agentId: null };

    if (item.kind === "note" || item.kind === "memory") {
      const text = item.text?.trim();

      return text
        ? { ok: true, value: { ...base, text: clampItemText(text) } }
        : { ok: false, error: `A ${item.kind} item needs text.` };
    }

    if (item.kind === "user_message") {
      const recent = await deps.loadMessages(orchestratorThreadId, USER_MESSAGE_LOOKBACK);
      const pool = recent
        .filter((m) => m.role === "user")
        .map((m) => ({ id: m.id, text: uiMessageText(m) }))
        .filter((m) => m.text);
      const current = input.currentUserMessage;

      if (current?.text.trim() && !pool.some((m) => m.id === current.id)) pool.push(current);
      const quote = item.text?.trim();

      if (!quote) {
        const latest = pool.at(-1);

        return latest
          ? {
              ok: true,
              value: { ...base, text: clampItemText(latest.text), sourceMessageId: latest.id },
            }
          : { ok: false, error: "There is no user message in this thread to attach." };
      }

      const wanted = normalizeQuote(quote);
      const source = [...pool].reverse().find((m) => normalizeQuote(m.text).includes(wanted));

      return source
        ? { ok: true, value: { ...base, text: clampItemText(quote), sourceMessageId: source.id } }
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
        ? { ok: true, value: { ...base, text: "", agentId } }
        : { ok: false, error: `No subagent "${agent}" on the roster.` };
    }

    const child = await findChild(agent);

    if (!child)
      return { ok: false, error: `"${agent}" has no thread under this orchestrator yet.` };
    const messages = await deps.loadMessages(child.threadId, SUBAGENT_OUTPUT_LOOKBACK);
    const picked = item.messageId
      ? messages.find((m) => m.id === item.messageId)
      : [...messages].reverse().find((m) => m.role === "assistant" && uiMessageText(m));
    const text = picked ? uiMessageText(picked) : "";

    if (!picked || !text) {
      return {
        ok: false,
        error: item.messageId
          ? `Message ${item.messageId} is not in ${resolveSubagentIdentity(child.agentId).name}'s recent thread.`
          : `${resolveSubagentIdentity(child.agentId).name} has no output yet. Use live_subagent_output to send whatever it produces next.`,
      };
    }

    return {
      ok: true,
      value: {
        ...base,
        text: clampItemText(text),
        sourceMessageId: picked.id,
        agentId: child.agentId,
      },
    };
  };

  const resolveItems = async (
    items: ReadonlyArray<WorktableItemInput> | undefined
  ): Promise<Resolution<ResolvedWorktableItem[]>> => {
    const resolved: ResolvedWorktableItem[] = [];

    for (const [index, item] of (items ?? []).entries()) {
      const result = await resolveItem(item);

      if (!result.ok) return { ok: false, error: `Item ${index + 1}: ${result.error}` };
      resolved.push(result.value);
    }

    return { ok: true, value: resolved };
  };

  const worktable = tool({
    description:
      "Your private worktable of reusable context bundles for subagents. List, view, create, update, or delete bundles, and add, replace, or remove single items. Bundles are only sent when you pass them to dispatch_subagent.",
    inputSchema: WorktableToolInputSchema,
    execute: async (args) => {
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
                items: items.value,
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
            return items.value.length > 0
              ? addBundleItems(table, ref, items.value, at)
              : { ok: false, error: "add_items needs items." };
          case "update_item":
            return args.itemIds?.length === 1 && items.value.length === 1
              ? replaceBundleItem(table, ref, args.itemIds[0]!, items.value[0]!, at)
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

  const runDispatch = async (args: z.infer<typeof DispatchToolInputSchema>) => {
    if (dispatchesThisTurn >= ORCHESTRATOR_MAX_DISPATCHES_PER_TURN) {
      return {
        success: false,
        error: `You can dispatch at most ${ORCHESTRATOR_MAX_DISPATCHES_PER_TURN} times per turn. Tell the user what is queued next.`,
      };
    }

    const brief = args.brief.trim();

    if (!brief) return { success: false, error: "The brief is empty." };
    const children = await listChildren();
    const agentId = resolveDispatchTarget(args.agent, children);

    if (!agentId) {
      return {
        success: false,
        error: `No subagent "${args.agent}" on the roster. Use an agentId, name, or role from [Orchestrator].`,
      };
    }

    let bundles: ContextBundle[] = [];

    if (args.bundles?.length) {
      const table = input.worktable ? await input.worktable.read() : null;

      if (!table) return { success: false, error: WORKTABLE_UNAVAILABLE_ERROR };
      const missing = args.bundles.filter((ref) => !findBundle(table, ref));

      if (missing.length > 0) {
        return {
          success: false,
          error: `No bundle ${missing.map((m) => `"${m}"`).join(", ")} on the worktable.`,
        };
      }
      const byId = new Map<string, ContextBundle>();

      for (const ref of args.bundles) {
        const bundle = findBundle(table, ref);

        if (bundle) byId.set(bundle.id, bundle);
      }
      bundles = [...byId.values()];
    }

    const items = await resolveItems(args.items);

    if (!items.ok) return { success: false, error: items.error };
    const context = await renderDispatchContext({ bundles, items: items.value, resolveLive });

    if (context.length > WORKTABLE_LIMITS.dispatchContextChars) {
      return {
        success: false,
        error: `That context is ${context.length} characters; the limit per dispatch is ${WORKTABLE_LIMITS.dispatchContextChars}. Send fewer bundles or trim items.`,
      };
    }

    if (input.autonomous) {
      if (input.worktable) {
        const reserved = await input.worktable.mutate((table) =>
          reserveAutonomousDispatch(table, ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES)
        );

        if (!reserved.ok) return { success: false, error: reserved.error };
      } else {
        if (autonomousLeft <= 0) {
          return {
            success: false,
            error: `Automatic turns may dispatch at most ${ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES} times until the user speaks again. Tell the user what you would send next instead.`,
          };
        }
        autonomousLeft -= 1;
      }
    }

    const identity = resolveSubagentIdentity(agentId);
    const existing = children.find((c) => c.agentId === agentId);
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
        error:
          "Subagent storage is unavailable, so nothing was sent. Do the work here or tell the user.",
      };
    }

    const goal = createWorkerGoal({
      orchestratorId: orchestratorThreadId,
      workerAgentId: agentId,
      goal: brief,
      now: now(),
    });
    const saved = await deps.appendMessages(threadId, [
      buildSubagentGoalMessage({
        goal: brief,
        goalId: goal.goalId,
        id: goal.goalId,
        context,
        bundles: bundles.map((b) => ({ id: b.id, name: b.name })),
      }),
    ]);

    if (!saved)
      return { success: false, error: "Could not save the assignment, so nothing was sent." };
    await deps.setStatus(threadId, "working");
    await deps.enqueueWorker({
      goal,
      threadId,
      modelId: input.modelId,
      zeroDataRetention: input.zeroDataRetention,
    });
    dispatchesThisTurn += 1;

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

    const wasWorking =
      existing &&
      resolveEffectiveSubagentStatus(existing.status, existing.statusAt, now()) === "working";

    return {
      success: true,
      agentId,
      name: identity.name,
      role: identity.role,
      goalId: goal.goalId,
      bundlesSent: bundles.map((b) => b.name),
      contextItems: bundles.reduce((n, b) => n + b.items.length, 0) + items.value.length,
      contextChars: context.length,
      ...(wasWorking
        ? { note: `${identity.name} was already working; this runs after its current assignment.` }
        : {}),
    };
  };

  const dispatch_subagent = tool({
    description:
      "Send work to one subagent. It runs in the background in the subagent's own thread and sees only this brief and the context you attach — not this conversation. Returns immediately.",
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
 * Merge an Arcadia orchestrator's own tools into a compiled toolset: `read_subagent_thread` once
 * it has subagent threads, and `worktable` + `dispatch_subagent` whenever it writes its own
 * dispatches — including the first turn, before any subagent thread exists.
 */
export function withArcadiaOrchestratorTools(
  compiled: { tools: ToolSet; toolInstructions: string },
  args: Omit<OrchestratorToolsInput, "worktable"> & { multitask: PrepareMultitaskTurnResult | null }
): { tools: ToolSet; toolInstructions: string } {
  const { multitask, ...toolsInput } = args;

  if (multitask?.role !== "orchestrator") return compiled;
  let next = compiled;

  if (multitask.hasSubagentThreads) {
    next = withReadSubagentThreadTool(next, {
      orchestratorThreadId: toolsInput.orchestratorThreadId,
      deps: toolsInput.deps,
    });
  }
  if (multitask.orchestratorDispatch) {
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

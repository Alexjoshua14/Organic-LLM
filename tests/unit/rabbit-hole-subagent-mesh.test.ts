import type { UIMessage } from "ai";
import type { SubagentThreadRow } from "@/lib/llm/subagents/threads/snapshot";
import type { Worktable } from "@/lib/llm/subagents/worktable/types";

import { describe, expect, mock, test } from "bun:test";

import { resolveSubagentIdentity } from "@/lib/arcadia/multitask/subagent-identity";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { coderSubagent } from "@/lib/llm/subagents/hard-set/agents/coder";
import { getHardSetSubagent, listRosterHardSetSubagents } from "@/lib/llm/subagents/hard-set/registry";
import {
  createSubagentBudgetPolicy,
  estimateCallCostUsd,
  formatSubagentCostPolicy,
  selectSubagentModel,
} from "@/lib/llm/subagents/orchestrator/cost-policy";
import { formatOrchestratorFragment } from "@/lib/llm/subagents/orchestrator/format-orchestrator-fragment";
import {
  createOrchestratorTools,
  resolveDispatchTarget,
  type OrchestratorToolDeps,
} from "@/lib/llm/subagents/orchestrator/orchestrator-tools";
import { prepareRabbitHoleMultitaskTurn } from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";
import { buildSubagentReplyMessage, uiMessageText } from "@/lib/llm/subagents/threads/messages";
import { estimateWorkerInput, workerModelMessages } from "@/lib/llm/subagents/worker/prepare-input";
import {
  formatWorkbenchCompactGuide,
  getWorkbenchManpage,
  WORKBENCH_MANPAGE_TOPICS,
} from "@/lib/llm/subagents/worktable/manpages";
import { createWorktableSession, type WorktableStore } from "@/lib/llm/subagents/worktable/session";
import {
  formatRabbitHoleNodeForWorktable,
  resolveShorthandRef,
  resolveShorthandRefs,
  type RabbitHoleNodeLike,
} from "@/lib/llm/subagents/worktable/shorthand";
import { emptyWorktable } from "@/lib/llm/subagents/worktable/types";
import { models } from "@/lib/schemas/chat-models";

const ORCH_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const ROOT_NODE_ID = "33333333-3333-4333-8333-333333333333";
const BRANCH_NODE_ID = "44444444-4444-4444-8444-444444444444";
const NOW = "2026-10-21T18:00:00.000Z";
const CALL = { toolCallId: "tc-mesh", messages: [] };

const sampleNodes: Record<string, RabbitHoleNodeLike> = {
  [ROOT_NODE_ID]: {
    id: ROOT_NODE_ID,
    title: "Distributed Consensus & Raft Leases",
    userQuestion: "How do leader leases avoid split-brain reads in Raft?",
    summary:
      "Leader leases bound clock drift to serve linearizable local reads without a quorum round-trip.",
    keyTakeaways: [
      "Lease duration must be strictly shorter than election timeout divided by clock drift bound.",
      "ReadIndex is safer when monotonic hardware clocks cannot be guaranteed.",
      "CheckQuorum prevents partitioned leaders from serving stale lease reads.",
    ],
    articleHtml: "<section><p>Full HTML body that should not be pasted raw.</p></section>",
    sources: [
      {
        id: "src-1",
        title: "In Search of an Understandable Consensus Algorithm",
        url: "https://raft.github.io/raft.pdf",
        snippet: "Section 6.4 covers linearizable read-only queries and clock-bounded leases.",
      },
    ],
    branchSuggestions: [
      { id: "b-1", label: "ReadIndex vs LeaseRead latency" },
      { id: "b-2", label: "TrueTime bounded uncertainty" },
    ],
  },
  [BRANCH_NODE_ID]: {
    id: BRANCH_NODE_ID,
    title: "ReadIndex Batching Under Contention",
    userQuestion: "How does ReadIndex amortize quorum heartbeats?",
    summary: "Coalesces concurrent read requests behind a single commit-index heartbeat round.",
    keyTakeaways: [
      "One heartbeat confirms leadership for an entire batch of concurrent readers.",
    ],
    sources: [],
  },
};

function createTestHarness(options?: {
  hardLimitUsd?: number;
  planBudget?: { spentUsd?: number; limitUsd?: number | null; canDispatch: boolean };
  maxDispatchesPerTurn?: number;
  zeroDataRetention?: boolean;
}) {
  let state = { worktable: emptyWorktable(), revision: null as string | null };
  let saves = 0;
  const store: WorktableStore = {
    load: async () => structuredClone(state),
    save: async (worktable: Worktable, previous: string | null) => {
      if (previous !== state.revision) return { status: "conflict" };
      saves += 1;
      state = { worktable: structuredClone(worktable), revision: `r${saves}` };

      return { status: "saved", revision: state.revision };
    },
  };

  const threads = new Map<string, UIMessage[]>([
    [
      ORCH_ID,
      [
        {
          id: "u-root",
          role: "user",
          parts: [{ type: "text", text: "Compare lease reads vs ReadIndex and prototype a lease guard." }],
        },
      ],
    ],
  ]);
  const children: SubagentThreadRow[] = [];

  const deps: OrchestratorToolDeps = {
    listChildren: mock(async () => children.map((c) => ({ ...c }))),
    loadMessages: mock(async (threadId: string, limit: number) =>
      (threads.get(threadId) ?? []).slice(-limit)
    ),
    inspectWorkerInput: mock(async (input) =>
      estimateWorkerInput({
        instructions: "worker",
        toolSchemaText: "[]",
        messages: await workerModelMessages(input.history, input.assignment),
        modelId: input.modelId,
      })
    ),
    ensureChild: mock(async ({ agentId }: { agentId: string }) => {
      const threadId = `thread-${agentId}`;

      children.push({ threadId, agentId, status: "idle", statusAt: NOW });

      return threadId;
    }),
    appendMessages: mock(async (threadId: string, messages: UIMessage[]) => {
      threads.set(threadId, [...(threads.get(threadId) ?? []), ...messages]);

      return true;
    }),
    setStatus: mock(async (threadId: string, status: SubagentThreadRow["status"]) => {
      for (const child of children) {
        if (child.threadId === threadId) child.status = status;
      }
    }),
    enqueueWorker: mock(async () => {}),
  };

  const tools = createOrchestratorTools({
    orchestratorThreadId: ORCH_ID,
    deps,
    worktable: createWorktableSession(store),
    modelId: models.anthropic.sonnet.id,
    zeroDataRetention: options?.zeroDataRetention ?? true,
    autonomous: false,
    rabbitHoleNodes: sampleNodes,
    rabbitHoleRootNodeId: ROOT_NODE_ID,
    rabbitHoleActiveNodeId: BRANCH_NODE_ID,
    hardLimitUsd: options?.hardLimitUsd,
    planBudget: options?.planBudget,
    maxDispatchesPerTurn: options?.maxDispatchesPerTurn ?? 4,
    now: () => Date.parse(NOW),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = (toolName: "worktable" | "dispatch_subagent", args: any) =>
    tools[toolName]!.execute!(args, CALL) as Promise<Record<string, unknown>>;

  return { run, deps, threads, children, store: () => state.worktable };
}

describe("Reed (subagent-coder) hard-set persona & roster slot binding", () => {
  test("defines Reed with locked coding persona, tool policy, and agent-coder slot binding", () => {
    expect(coderSubagent.id).toBe("subagent-coder");
    expect(coderSubagent.name).toBe("Reed");
    expect(coderSubagent.role).toBe("coder");
    expect(coderSubagent.roster).toBe(true);
    expect(coderSubagent.rosterSlotId).toBe("agent-coder");
    expect(coderSubagent.tools).toEqual({
      webSearch: true,
      memory: false,
      chatHistory: false,
      research: false,
    });
    expect(coderSubagent.helpMenu.startsWith("**Reed** · coding subagent")).toBe(true);
    expect(coderSubagent.instructions).toContain("Archer");
    expect(coderSubagent.instructions).toContain("Lyra");

    expect(getHardSetSubagent("subagent-coder")).toBe(coderSubagent);
    expect(getHardSetSubagent("agent-coder")).toBe(coderSubagent);
    expect(listRosterHardSetSubagents()).toContain(coderSubagent);
  });

  test("resolves dispatch targets for Reed, coder, subagent-coder, and agent-coder to agent-coder without duplicating roster entries", () => {
    for (const target of ["Reed", "reed", "@reed", "coder", "subagent-coder", "agent-coder"]) {
      expect(resolveDispatchTarget(target, [])).toBe("agent-coder");
    }
    expect(resolveSubagentIdentity("agent-coder")).toMatchObject({
      agentId: "agent-coder",
      name: "Reed",
      role: "coder",
      blurb: coderSubagent.blurb,
    });

    const fragment = formatOrchestratorFragment({
      snapshots: [],
      autonomous: false,
      autonomousRemaining: null,
    });
    expect(fragment.match(/Reed \(coder, agentId=agent-coder\)/g)).toHaveLength(1);
    expect(fragment).toContain("Locked persona");
  });
});

describe("LLM Workbench manpages", () => {
  test("worktable man action returns overview and topic-specific manpages without mutating storage", async () => {
    const { run, store } = createTestHarness();

    const overview = await run("worktable", { action: "man" });
    expect(overview).toMatchObject({
      success: true,
      ok: true,
      topic: "overview",
      known: true,
    });
    expect(String(overview.manpage)).toContain("NAME");
    expect(String(overview.manpage)).toContain("SYNOPSIS");

    for (const topic of ["lyra", "reed", "archer", "shorthand", "budget", "rabbit_hole"] as const) {
      const res = await run("worktable", { action: "man", topic });
      expect(res).toMatchObject({
        success: true,
        ok: true,
        topic,
        known: true,
      });
      expect(String(res.manpage)).toContain("NAME");
      expect(String(res.manpage)).toContain("SYNOPSIS");
      expect(String(res.manpage)).toContain("SHORTHAND");
      expect(String(res.manpage)).toContain("BUDGET & ZDR");
      expect(String(res.manpage)).toContain("EXAMPLES");
    }

    expect(WORKBENCH_MANPAGE_TOPICS.length).toBeGreaterThanOrEqual(12);
    expect(getWorkbenchManpage("@reed").topic).toBe("reed");
    expect(getWorkbenchManpage("unknown-topic").known).toBe(false);
    expect(formatWorkbenchCompactGuide()).toContain('worktable({ action: "man"');
    expect(store().bundles).toHaveLength(0);
  });
});

describe("Shorthand context bundling (node:<id>, out:<agentId>, msg:<id>, bundle:<id>)", () => {
  test("resolves node:<nodeId>, node:root, node:active, and out:<agentId> into structured items", () => {
    const rootResolved = resolveShorthandRef("node:root", {
      nodesById: sampleNodes,
      rootNodeId: ROOT_NODE_ID,
      activeNodeId: BRANCH_NODE_ID,
    });
    expect(rootResolved.ok).toBe(true);
    if (!rootResolved.ok || rootResolved.kind !== "item") throw new Error("Expected item");
    expect(rootResolved.item.kind).toBe("note");
    expect(rootResolved.item.sourceRef).toBe(`node:${ROOT_NODE_ID}`);
    expect(rootResolved.item.text).toContain("Distributed Consensus & Raft Leases");
    expect(rootResolved.item.text).toContain("Leader leases bound clock drift");
    expect(rootResolved.item.text).toContain("https://raft.github.io/raft.pdf");
    expect(rootResolved.item.text).not.toContain("<section>");

    const batch = resolveShorthandRefs(
      [`node:${BRANCH_NODE_ID}`, "out:Reed", "out:agent-researcher", "bundle:Consensus Kit"],
      {
        nodesById: sampleNodes,
        rootNodeId: ROOT_NODE_ID,
        activeNodeId: BRANCH_NODE_ID,
      }
    );
    expect(batch.ok).toBe(true);
    if (!batch.ok) throw new Error(batch.error);
    expect(batch.bundles).toEqual(["Consensus Kit"]);
    expect(batch.items).toHaveLength(3);
    expect(batch.items[0]).toMatchObject({
      kind: "note",
      sourceRef: `node:${BRANCH_NODE_ID}`,
    });
    expect(batch.items[1]).toMatchObject({
      kind: "live_subagent_output",
      agentId: "agent-coder",
      sourceRef: "out:agent-coder",
    });
    expect(batch.items[2]).toMatchObject({
      kind: "live_subagent_output",
      agentId: "agent-researcher",
      sourceRef: "out:agent-researcher",
    });
  });

  test("expands shorthand refs in worktable create/add_items and dispatch_subagent", async () => {
    const { run, threads } = createTestHarness();

    // Seed Lyra's thread with a reply so out:agent-researcher resolves live output on dispatch
    await run("dispatch_subagent", {
      agent: "Lyra",
      brief: "Audit primary Raft lease paper.",
      shorthand: ["node:root"],
    });
    threads
      .get("thread-agent-researcher")!
      .push(
        buildSubagentReplyMessage({
          text: "Verified: Section 6.4 requires bounded clock drift.",
          goalId: "g-lyra",
          modelId: models.anthropic.haiku.id,
        })
      );

    const created = await run("worktable", {
      action: "create",
      name: "Lease Kit",
      shorthand: ["node:active", "out:agent-researcher"],
    });
    expect(created.success).toBe(true);

    const dispatched = await run("dispatch_subagent", {
      agent: "Reed",
      brief: "Implement a monotonic lease guard in TypeScript.",
      shorthand: ["bundle:Lease Kit", "msg:u-root"],
      additionalDispatchReason: "Independent code prototype consuming Lyra's lease verification.",
    });
    expect(dispatched).toMatchObject({
      success: true,
      agentId: "agent-coder",
      bundlesSent: ["Lease Kit"],
    });

    const reedMessages = threads.get("thread-agent-coder")!;
    const assignmentText = uiMessageText(reedMessages.at(-1)!);
    expect(assignmentText).toContain("ReadIndex Batching Under Contention");
    expect(assignmentText).toContain("Verified: Section 6.4 requires bounded clock drift.");
    expect(assignmentText).toContain("Compare lease reads vs ReadIndex");
    expect(formatRabbitHoleNodeForWorktable(sampleNodes[ROOT_NODE_ID]!)).toContain(
      "Key Takeaways:"
    );
  });
});

describe("Self-managed budget ledger, multi-tier selection & parallel delegation", () => {
  test("supports micro, economy, standard, and frontier tiers with reason & ZDR enforcement", () => {
    expect(selectSubagentModel({ tier: "micro", zeroDataRetention: true })).toEqual({
      ok: true,
      modelId: models.google.flashLite.id,
      tier: "micro",
    });
    expect(selectSubagentModel({ tier: "economy", zeroDataRetention: true })).toEqual({
      ok: true,
      modelId: models.anthropic.haiku.id,
      tier: "economy",
    });
    expect(selectSubagentModel({ tier: "standard", reason: "short", zeroDataRetention: true }).ok).toBe(
      false
    );
    expect(
      selectSubagentModel({
        tier: "standard",
        reason: "Complex concurrency invariants and streaming backpressure.",
        zeroDataRetention: true,
      })
    ).toEqual({
      ok: true,
      modelId: models.anthropic.sonnet.id,
      tier: "standard",
    });
    expect(selectSubagentModel({ tier: "frontier", reason: "short", zeroDataRetention: true }).ok).toBe(
      false
    );
    expect(
      selectSubagentModel({
        tier: "frontier",
        reason: "Requires formal verification across multi-node consensus state transitions.",
        zeroDataRetention: true,
      })
    ).toEqual({
      ok: true,
      modelId: models.anthropic.opus.id,
      tier: "frontier",
    });

    const tokens = { estimatedInputTokens: 2_000, maxOutputTokens: 1_500 };
    const microCost = estimateCallCostUsd({ tier: "micro", ...tokens });
    const economyCost = estimateCallCostUsd({ tier: "economy", ...tokens });
    const standardCost = estimateCallCostUsd({ tier: "standard", ...tokens });
    const frontierCost = estimateCallCostUsd({ tier: "frontier", ...tokens });

    expect(microCost).toBeLessThan(economyCost);
    expect(economyCost).toBeLessThan(standardCost);
    expect(standardCost).toBeLessThan(frontierCost);
  });

  test("allows up to 4 parallel dispatches in Rabbit Hole mode and enforces hard USD budget with downshift feedback", async () => {
    // Allow enough for ~2 economy dispatches or 1 micro dispatch, but block frontier/standard
    const { run, deps } = createTestHarness({
      hardLimitUsd: 0.015,
      planBudget: { spentUsd: 9.985, limitUsd: 10, canDispatch: true },
      maxDispatchesPerTurn: 4,
    });

    // Frontier dispatch (~$0.03+) should be blocked by the $0.015 hard limit with downshift advice
    const frontierAttempt = await run("dispatch_subagent", {
      agent: "Archer",
      brief: "Design the full distributed lease state machine.",
      modelTier: "frontier",
      modelReason: "Needs deep formal reasoning across multi-region failure modes.",
    });
    expect(frontierAttempt.success).toBe(false);
    expect(frontierAttempt.ok).toBe(false);
    expect(String(frontierAttempt.error)).toContain("exceeding");
    expect(["micro", "economy"]).toContain(frontierAttempt.suggestedTier as string);
    expect(frontierAttempt.budget).toMatchObject({
      hardLimitUsd: 0.015,
      zeroDataRetention: true,
    });

    // Parallel fan-out across 4 specialists using micro tier fits comfortably within $0.015
    const parallel = await Promise.all(
      [
        { agent: "Lyra", brief: "Check Raft section 6.4 citations." },
        { agent: "Reed", brief: "Write a monotonic clock lease check snippet." },
        { agent: "Archer", brief: "Sketch the lease-guard interface boundary." },
        { agent: "Vesper", brief: "List clock-skew failure modes for lease reads." },
      ].map((task, idx) =>
        run("dispatch_subagent", {
          ...task,
          modelTier: "micro",
          additionalDispatchReason:
            idx > 0 ? "Independent parallel workstream for the Rabbit Hole exploration." : undefined,
        })
      )
    );

    expect(parallel.every((r) => r.success === true)).toBe(true);
    expect(deps.enqueueWorker).toHaveBeenCalledTimes(4);
    const lastBudget = parallel[3]!.budget as {
      turnEstimatedSpendUsd: number;
      remainingUsd: number;
      hardLimitUsd: number;
    };
    expect(lastBudget.turnEstimatedSpendUsd).toBeGreaterThan(0);
    expect(lastBudget.turnEstimatedSpendUsd).toBeLessThanOrEqual(0.015);

    const policyText = formatSubagentCostPolicy(
      createSubagentBudgetPolicy({
        planBudget: { spentUsd: 4.25, limitUsd: 15, canDispatch: true },
        hardLimitUsd: 0.5,
        zeroDataRetention: true,
      }).snapshot()
    );
    expect(policyText).toContain("Self-managed budget ledger");
    expect(policyText).toContain("plan remaining $10.75 of $15.00");
  });
});

describe("Rabbit Hole compileChatTools & turn preparation integration", () => {
  test("compileChatTools for experience='rabbit_hole' exposes both Rabbit Hole tools and subagent orchestrator tools", async () => {
    const { deps } = createTestHarness();
    const multitask = await prepareRabbitHoleMultitaskTurn({
      chatId: ORCH_ID,
      ownerId: "user-1",
      userText: "Explore Raft leases with Lyra and Reed.",
      modelId: models.anthropic.sonnet.id,
      zeroDataRetention: true,
      deps: {
        ...deps,
        getLink: async () => null,
        isMultitaskEnabled: async () => false,
        recordUsage: () => {},
      },
      planBudget: { spentUsd: 2.0, limitUsd: 15.0, canDispatch: true },
    });

    expect(multitask?.role).toBe("orchestrator");
    expect(multitask?.orchestratorDispatch).toBe(true);
    const systemText = multitask?.systemFragments.join("\n") ?? "";
    expect(systemText).toContain("Reed (coder, agentId=agent-coder)");
    expect(systemText).toContain("Lyra (researcher, agentId=agent-researcher)");
    expect(systemText).toContain("Archer (architect, agentId=subagent-architect)");
    expect(systemText).toContain("[LLM Workbench Quick Reference]");

    const compiled = await compileChatTools({
      experience: "rabbit_hole",
      rabbitHoleSessionId: SESSION_ID,
      rabbitHoleActiveNodeId: BRANCH_NODE_ID,
      rabbitHoleRootNodeId: ROOT_NODE_ID,
      rabbitHoleNodes: sampleNodes,
      useSearch: false,
      useMemory: true,
      chatId: ORCH_ID,
      sbUserId: "user-1",
      multitaskOrchestrator: {
        multitask,
        orchestratorThreadId: ORCH_ID,
        deps,
        modelId: models.anthropic.sonnet.id,
        zeroDataRetention: true,
        autonomous: false,
        rabbitHoleNodes: sampleNodes,
        rabbitHoleActiveNodeId: BRANCH_NODE_ID,
        rabbitHoleRootNodeId: ROOT_NODE_ID,
      },
    });

    const toolNames = Object.keys(compiled.tools);
    expect(toolNames).toContain("navigate_rabbit_hole_node");
    expect(toolNames).toContain("generate_rabbit_hole_node");
    expect(toolNames).toContain("search_rabbit_hole_context");
    expect(toolNames).toContain("search_memories");
    expect(toolNames).toContain("worktable");
    expect(toolNames).toContain("dispatch_subagent");
    expect(toolNames).toContain("read_subagent_thread");
    expect(compiled.toolInstructions).toContain("dispatch_subagent");
    expect(compiled.toolInstructions).toContain("navigate_rabbit_hole_node");
  });
});

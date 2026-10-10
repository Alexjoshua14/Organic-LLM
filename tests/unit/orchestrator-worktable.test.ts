import type { UIMessage } from "ai";
import type { SubagentThreadRow } from "@/lib/llm/subagents/threads/snapshot";
import type { Worktable } from "@/lib/llm/subagents/worktable/types";

import { describe, expect, mock, test } from "bun:test";

import {
  createOrchestratorTools,
  type OrchestratorToolDeps,
} from "@/lib/llm/subagents/orchestrator/orchestrator-tools";
import {
  buildSubagentGoalMessage,
  buildSubagentReplyMessage,
  subagentGoalBrief,
  uiMessageText,
} from "@/lib/llm/subagents/threads/messages";
import { buildSubagentThreadSnapshot } from "@/lib/llm/subagents/threads/snapshot";
import {
  addBundleItems,
  createBundle,
  removeBundleItems,
  replaceBundleItem,
} from "@/lib/llm/subagents/worktable/operations";
import { createWorktableSession, type WorktableStore } from "@/lib/llm/subagents/worktable/session";
import { emptyWorktable } from "@/lib/llm/subagents/worktable/types";

const ORCH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CODER_THREAD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CRITIC_THREAD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NOW = "2026-10-09T12:00:00.000Z";
const CALL = { toolCallId: "tc", messages: [] };

function userMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function memoryStore(initial: Partial<Worktable> = {}) {
  let state = { worktable: { ...emptyWorktable(), ...initial }, revision: null as string | null };
  let saves = 0;
  const store = {
    load: mock(async () => structuredClone(state)),
    save: mock(async (worktable: Worktable, previous: string | null) => {
      if (previous !== state.revision) return { status: "conflict" as const };
      saves += 1;
      state = { worktable: structuredClone(worktable), revision: `r${saves}` };

      return { status: "saved" as const, revision: state.revision };
    }),
  } satisfies WorktableStore;

  return {
    store,
    current: () => state.worktable,
    /** Another request writes between our load and save. */
    bumpElsewhere: (edit: (w: Worktable) => Worktable) => {
      saves += 1;
      state = { worktable: edit(structuredClone(state.worktable)), revision: `r${saves}` };
    },
  };
}

/** One orchestrator thread with in-memory children and messages. */
function harness(options: { autonomous?: boolean; worktable?: "memory" | "none" } = {}) {
  const threads = new Map<string, UIMessage[]>([
    [ORCH, [userMessage("u1", "Build the CSV export. It must stream — files can be 2 GB.")]],
  ]);
  const children: SubagentThreadRow[] = [];
  const memory = memoryStore();
  const deps = {
    listChildren: mock(async () => children.map((c) => ({ ...c }))),
    loadMessages: mock(async (threadId: string, limit: number) => (threads.get(threadId) ?? []).slice(-limit)),
    ensureChild: mock(async ({ agentId }: { agentId: string }) => {
      const threadId = agentId === "agent-critic" ? CRITIC_THREAD : CODER_THREAD;

      children.push({ threadId, agentId, status: "idle", statusAt: NOW });

      return threadId;
    }),
    appendMessages: mock(async (threadId: string, messages: UIMessage[]) => {
      threads.set(threadId, [...(threads.get(threadId) ?? []), ...messages]);

      return true;
    }),
    setStatus: mock(async () => {}),
    enqueueWorker: mock(async () => {}),
  } satisfies OrchestratorToolDeps;
  const writer = { write: mock(() => {}) };
  const tools = createOrchestratorTools({
    orchestratorThreadId: ORCH,
    deps,
    worktable: options.worktable === "none" ? null : createWorktableSession(memory.store),
    modelId: "test-model",
    zeroDataRetention: true,
    autonomous: options.autonomous ?? false,
    currentUserMessage: { id: "u2", text: "Have someone review it before we ship." },
    writer,
    now: () => Date.parse(NOW),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = (name: "worktable" | "dispatch_subagent", args: any) =>
    tools[name]!.execute!(args, CALL) as Promise<Record<string, unknown>>;

  return { threads, children, deps, writer, memory, run };
}

function lastMessage(threads: Map<string, UIMessage[]>, threadId: string): UIMessage {
  return threads.get(threadId)!.at(-1)!;
}

describe("worktable operations", () => {
  test("bundles keep item ids stable across replace and remove", () => {
    let ids = 0;
    const newId = () => String((ids += 1)).padStart(6, "0");
    const note = (text: string) => ({ kind: "note" as const, label: null, text, sourceMessageId: null, agentId: null });
    const created = createBundle(emptyWorktable(), { name: "Review kit", items: [note("a"), note("b")] }, NOW, newId);

    if (!created.ok) throw new Error(created.error);
    const [first, second] = created.value.items;
    const replaced = replaceBundleItem(created.worktable, "review kit", second!.id, note("b2"), NOW);

    if (!replaced.ok) throw new Error(replaced.error);
    expect(replaced.value.items.map((i) => [i.id, i.text])).toEqual([
      [first!.id, "a"],
      [second!.id, "b2"],
    ]);

    const removed = removeBundleItems(replaced.worktable, created.value.id, [first!.id], NOW);

    expect(removed.ok && removed.value.items.map((i) => i.text)).toEqual(["b2"]);
    expect(createBundle(created.worktable, { name: "REVIEW KIT" }, NOW).ok).toBe(false);
    expect(addBundleItems(created.worktable, "missing", [note("x")], NOW).ok).toBe(false);
  });

  test("parallel edits in one turn both land, and a write from elsewhere is retried on fresh state", async () => {
    const memory = memoryStore();
    const session = createWorktableSession(memory.store);

    await Promise.all([
      session.mutate((w) => createBundle(w, { name: "One" }, NOW)),
      session.mutate((w) => createBundle(w, { name: "Two" }, NOW)),
    ]);
    memory.bumpElsewhere((w) => ({ ...w, autonomousDispatches: 2 }));
    await session.mutate((w) => createBundle(w, { name: "Three" }, NOW));

    expect(memory.current().bundles.map((b) => b.name)).toEqual(["One", "Two", "Three"]);
    expect(memory.current().autonomousDispatches).toBe(2);
  });
});

describe("dispatch_subagent", () => {
  test("writes the orchestrator's brief and context into the subagent's own thread", async () => {
    const { threads, deps, writer, run } = harness();

    const result = await run("dispatch_subagent", {
      agent: "coder",
      brief: "Implement a streaming CSV exporter for the reports page.",
      items: [
        { kind: "user_message", text: "it must  stream — files can be 2 GB" },
        { kind: "memory", text: "The user prefers small PRs." },
      ],
    });

    expect(result).toMatchObject({ success: true, agentId: "agent-coder", name: "Reed", contextItems: 2 });
    const assignment = lastMessage(threads, CODER_THREAD);
    const text = uiMessageText(assignment);

    expect(text.startsWith("From the orchestrator:\nImplement a streaming CSV exporter")).toBe(true);
    expect(text).toContain("[The user's words]\nit must  stream — files can be 2 GB");
    expect(text).toContain("[Memory]\nThe user prefers small PRs.");
    expect(subagentGoalBrief(assignment)).toBe("Implement a streaming CSV exporter for the reports page.");
    expect(assignment.id).toBe(result.goalId as string);

    const [[queued]] = deps.enqueueWorker.mock.calls;

    expect(queued.goal.goal).toBe("Implement a streaming CSV exporter for the reports page.");
    expect(queued.threadId).toBe(CODER_THREAD);
    expect(writer.write).toHaveBeenCalledTimes(1);
  });

  test("a quote the user never said is refused rather than passed off as theirs", async () => {
    const { deps, run } = harness();

    const result = await run("dispatch_subagent", {
      agent: "agent-coder",
      brief: "Implement the exporter.",
      items: [{ kind: "user_message", text: "use the legacy XML exporter" }],
    });

    expect(result.success).toBe(false);
    expect(deps.appendMessages).not.toHaveBeenCalled();
  });

  test("a review bundle built once is re-sent with the coder's latest output each time", async () => {
    const { threads, memory, run } = harness();

    await run("dispatch_subagent", { agent: "coder", brief: "Implement the exporter." });
    threads.get(CODER_THREAD)!.push(
      buildSubagentReplyMessage({ text: "Draft 1: buffered export.", goalId: "g1", modelId: "m" })
    );

    const created = await run("worktable", {
      action: "create",
      name: "Review kit",
      purpose: "For Vesper reviewing Reed's work",
      instructions: "Check streaming, memory use, and error handling. Reply with blocking issues first.",
      items: [
        { kind: "user_message", label: "requirement", text: "files can be 2 GB" },
        { kind: "live_subagent_output", agentId: "Reed" },
      ],
    });

    expect(created.success).toBe(true);

    await run("dispatch_subagent", { agent: "critic", brief: "Review Reed's exporter.", bundles: ["Review kit"] });
    expect(uiMessageText(lastMessage(threads, CRITIC_THREAD))).toContain(
      "[Reed (coder) — latest output]\nDraft 1: buffered export."
    );

    threads.get(CODER_THREAD)!.push(
      buildSubagentReplyMessage({ text: "Draft 2: streams in chunks.", goalId: "g2", modelId: "m" })
    );
    await run("dispatch_subagent", { agent: "Vesper", brief: "Re-review Reed's revision.", bundles: ["review kit"] });

    const second = uiMessageText(lastMessage(threads, CRITIC_THREAD));

    expect(second).toContain("Draft 2: streams in chunks.");
    expect(second).not.toContain("Draft 1");
    expect(second).toContain("Standing instructions:\nCheck streaming");
    expect(memory.current().bundles[0]).toMatchObject({ name: "Review kit", sendCount: 2 });
  });

  test("targets are limited to children and real roster slots", async () => {
    const { deps, run } = harness();

    const result = await run("dispatch_subagent", { agent: "worker-hacker-12345678", brief: "Do it." });

    expect(result.success).toBe(false);
    expect(deps.ensureChild).not.toHaveBeenCalled();
  });

  test("subagent_output only reads this orchestrator's own children", async () => {
    const { run } = harness();

    const result = await run("dispatch_subagent", {
      agent: "critic",
      brief: "Review.",
      items: [{ kind: "subagent_output", agentId: "agent-coder" }],
    });

    expect(result).toMatchObject({ success: false });
    expect(String(result.error)).toContain("no thread under this orchestrator");
  });

  test("one turn dispatches at most four times, even when the calls arrive in parallel", async () => {
    const { deps, run } = harness();

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => run("dispatch_subagent", { agent: "coder", brief: `Task ${i}` }))
    );

    expect(results.filter((r) => r.success)).toHaveLength(4);
    expect(deps.enqueueWorker).toHaveBeenCalledTimes(4);
    expect(deps.ensureChild).toHaveBeenCalledTimes(1);
  });

  test("automatic turns stop after three dispatches until the user speaks", async () => {
    const { memory, run } = harness({ autonomous: true });

    for (let i = 0; i < 3; i += 1) {
      expect((await run("dispatch_subagent", { agent: "coder", brief: `Follow-up ${i}` })).success).toBe(true);
    }
    expect((await run("dispatch_subagent", { agent: "coder", brief: "One more" })).success).toBe(false);
    expect(memory.current().autonomousDispatches).toBe(3);
  });

  test("automatic turns cannot dispatch without a worktable to count them", async () => {
    const { deps, run } = harness({ autonomous: true, worktable: "none" });

    expect((await run("dispatch_subagent", { agent: "coder", brief: "Follow-up" })).success).toBe(false);
    expect(deps.enqueueWorker).not.toHaveBeenCalled();
  });
});

describe("goal briefs downstream", () => {
  test("snapshots show the brief, not the attached context", () => {
    const message = buildSubagentGoalMessage({
      goal: "Review the exporter.",
      goalId: "g1",
      context: `### Context: Review kit\n\n${"x".repeat(2_000)}`,
    });
    const snapshot = buildSubagentThreadSnapshot(
      { threadId: CRITIC_THREAD, agentId: "agent-critic", status: "working", statusAt: NOW },
      [message],
      Date.parse(NOW)
    );

    expect(snapshot.lastGoal).toBe("Review the exporter.");
  });

  test("assignments without context keep the old shape", () => {
    const message = buildSubagentGoalMessage({ goal: "Do the thing.", goalId: "g1" });

    expect(message.metadata).toEqual({ source: "orchestrator", goalId: "g1" });
    expect(subagentGoalBrief(message)).toBe("Do the thing.");
  });
});

import type { UIMessage } from "ai";
import type { SubagentThreadRow } from "@/lib/llm/subagents/threads/snapshot";
import type { Worktable } from "@/lib/llm/subagents/worktable/types";

import { describe, expect, mock, test } from "bun:test";

import {
  countAutonomousDispatchesSinceUser,
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
import { models } from "@/lib/schemas/chat-models";
import { estimateWorkerInput, workerModelMessages } from "@/lib/llm/subagents/worker/prepare-input";
import { readSubagentContext } from "@/lib/llm/subagents/threads/context-items";

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
function harness(
  options: {
    autonomous?: boolean;
    autonomousRemaining?: number;
    worktable?: "memory" | "none";
  } = {}
) {
  const threads = new Map<string, UIMessage[]>([
    [ORCH, [userMessage("u1", "Build the CSV export. It must stream — files can be 2 GB.")]],
  ]);
  const children: SubagentThreadRow[] = [];
  const memory = memoryStore();
  const deps = {
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
      const threadId =
        agentId === "agent-coder"
          ? CODER_THREAD
          : agentId === "agent-critic"
            ? CRITIC_THREAD
            : `thread-${agentId}`;

      children.push({ threadId, agentId, status: "idle", statusAt: NOW });

      return threadId;
    }),
    appendMessages: mock(async (threadId: string, messages: UIMessage[]) => {
      threads.set(threadId, [...(threads.get(threadId) ?? []), ...messages]);

      return true;
    }),
    setStatus: mock(async (threadId: string, status: string) => {
      for (const child of children) if (child.threadId === threadId) child.status = status;
    }),
    enqueueWorker: mock(async () => {}),
  } satisfies OrchestratorToolDeps;
  const writer = { write: mock(() => {}) };
  const toolInput = {
    orchestratorThreadId: ORCH,
    deps,
    worktable: options.worktable === "none" ? null : createWorktableSession(memory.store),
    modelId: "test-model",
    zeroDataRetention: true,
    autonomous: options.autonomous ?? false,
    autonomousRemaining: options.autonomousRemaining ?? null,
    currentUserMessage: { id: "u2", text: "Have someone review it before we ship." },
    writer,
    now: () => Date.parse(NOW),
  };
  let tools = createOrchestratorTools(toolInput);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = (name: "worktable" | "dispatch_subagent", args: any) =>
    tools[name]!.execute!(args, CALL) as Promise<Record<string, unknown>>;

  return {
    threads,
    children,
    deps,
    writer,
    memory,
    run,
    nextTurn: () => {
      tools = createOrchestratorTools(toolInput);
    },
  };
}

function lastMessage(threads: Map<string, UIMessage[]>, threadId: string): UIMessage {
  return threads.get(threadId)!.at(-1)!;
}

describe("worktable operations", () => {
  test("bundles keep item ids stable across replace and remove", () => {
    let ids = 0;
    const newId = () => String((ids += 1)).padStart(6, "0");
    const note = (text: string) => ({
      kind: "note" as const,
      label: null,
      text,
      sourceMessageId: null,
      agentId: null,
    });
    const created = createBundle(
      emptyWorktable(),
      { name: "Review kit", items: [note("a"), note("b")] },
      NOW,
      newId
    );

    if (!created.ok) throw new Error(created.error);
    const [first, second] = created.value.items;
    const replaced = replaceBundleItem(
      created.worktable,
      "review kit",
      second!.id,
      note("b2"),
      NOW
    );

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

    expect(result).toMatchObject({
      success: true,
      agentId: "agent-coder",
      name: "Reed",
      contextItems: 2,
    });
    const assignment = lastMessage(threads, CODER_THREAD);
    const text = uiMessageText(assignment);

    expect(text.startsWith("From the orchestrator:\nImplement a streaming CSV exporter")).toBe(
      true
    );
    expect(text).toContain("[The user's words]");
    expect(text).toContain('"content":"it must  stream — files can be 2 GB"');
    expect(text).toContain('"content":"The user prefers small PRs."');
    expect(subagentGoalBrief(assignment)).toBe(
      "Implement a streaming CSV exporter for the reports page."
    );
    expect(assignment.id).toBe(result.goalId as string);
    expect(assignment.metadata).toMatchObject({
      modelId: models.anthropic.haiku.id,
      modelTier: "economy",
    });

    const [[queued]] = deps.enqueueWorker.mock.calls;

    expect(queued.goal.goal).toBe("Implement a streaming CSV exporter for the reports page.");
    expect(queued.threadId).toBe(CODER_THREAD);
    expect(queued.modelId).toBe(models.anthropic.haiku.id);
    expect(queued.zeroDataRetention).toBe(true);
    expect(result.modelId).toBe(queued.modelId);
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
    const { threads, memory, run, deps, nextTurn } = harness();

    await run("dispatch_subagent", { agent: "coder", brief: "Implement the exporter." });
    threads
      .get(CODER_THREAD)!
      .push(
        buildSubagentReplyMessage({ text: "Draft 1: buffered export.", goalId: "g1", modelId: "m" })
      );

    const created = await run("worktable", {
      action: "create",
      name: "Review kit",
      purpose: "For Vesper reviewing Reed's work",
      instructions:
        "Check streaming, memory use, and error handling. Reply with blocking issues first.",
      items: [
        { kind: "user_message", label: "requirement", text: "files can be 2 GB" },
        { kind: "live_subagent_output", agentId: "Reed" },
      ],
    });

    expect(created.success).toBe(true);

    await deps.setStatus(CODER_THREAD, "done");
    await run("dispatch_subagent", {
      agent: "critic",
      brief: "Review Reed's exporter.",
      bundles: ["Review kit"],
      additionalDispatchReason: "The user explicitly requested an independent streaming review.",
    });
    expect(uiMessageText(lastMessage(threads, CRITIC_THREAD))).toContain(
      '"content":"Draft 1: buffered export."'
    );

    threads.get(CODER_THREAD)!.push(
      buildSubagentReplyMessage({
        text: "Draft 2: streams in chunks.",
        goalId: "g2",
        modelId: "m",
      })
    );
    await deps.setStatus(CRITIC_THREAD, "done");
    nextTurn();
    await run("dispatch_subagent", {
      agent: "Vesper",
      brief: "Re-review Reed's revision.",
      bundles: ["review kit"],
    });

    const second = uiMessageText(lastMessage(threads, CRITIC_THREAD));

    expect(second).toContain("Draft 2: streams in chunks.");
    expect(second).not.toContain("Draft 1");
    expect(second).toContain("Standing instructions:\nCheck streaming");
    expect(memory.current().bundles[0]).toMatchObject({ name: "Review kit", sendCount: 2 });
  });

  test("targets are limited to children and real roster slots", async () => {
    const { deps, run } = harness();

    const result = await run("dispatch_subagent", {
      agent: "worker-hacker-12345678",
      brief: "Do it.",
    });

    expect(result.success).toBe(false);
    expect(deps.ensureChild).not.toHaveBeenCalled();
  });

  test("selected items and message excerpts produce an inspectable, scoped assignment", async () => {
    const { run, threads, memory } = harness();
    await run("worktable", {
      action: "create",
      name: "Kit",
      instructions: "Keep citations.",
      items: [
        { kind: "note", text: "unrelated" },
        { kind: "note", text: "prefix-needed-tail" },
      ],
    });
    const id = memory.current().bundles[0]!.items[1]!.id;
    const result = await run("dispatch_subagent", {
      agent: "coder",
      brief: "Check the requirement.",
      history: "fresh",
      bundles: [{ bundle: "Kit", items: [{ itemId: id, offset: 7, limit: 6 }] }],
      items: [{ kind: "user_message", messageId: "u1", offset: 6, limit: 3 }],
    });
    expect(result.success).toBe(true);
    const context = readSubagentContext(lastMessage(threads, CODER_THREAD))!;
    expect(context.items.map((item) => item.text)).toEqual(["needed", "the"]);
    expect(result.manifest).toMatchObject({
      omittedBundleItems: 1,
      history: { mode: "fresh", messageIds: [] },
      items: [
        { originalChars: 6, deliveredChars: 6, bundleItemId: id },
        { originalChars: 3, sourceMessageId: "u1" },
      ],
    });
    expect(uiMessageText(lastMessage(threads, CODER_THREAD))).not.toContain("unrelated");
    expect(memory.current().bundles[0]!.items[1]!.text).toBe("prefix-needed-tail");
  });

  test("large originals survive dispatch; only bounded, marked previews reach the worker", async () => {
    const { run, threads } = harness();
    const original = "full source 😀 ".repeat(2_000);
    const result = await run("dispatch_subagent", {
      agent: "coder",
      brief: "Review the source.",
      items: [{ kind: "note", text: original }],
    });
    expect(result.success).toBe(true);
    const assignment = lastMessage(threads, CODER_THREAD);
    expect(readSubagentContext(assignment)!.items[0]!.text).toBe(original);
    expect(result.manifest).toMatchObject({
      items: [{ originalChars: original.length, deliveredChars: 6_000, truncated: true }],
    });
    expect(uiMessageText(assignment)).toContain("[TRUNCATED: showing 6000");
    expect(uiMessageText(assignment).length).toBeLessThan(original.length);
  });

  test("dry runs make no writes, consume no dispatch, and retain prefix order for selected history", async () => {
    const { run, deps, children, threads } = harness();
    children.push({
      threadId: CODER_THREAD,
      agentId: "agent-coder",
      status: "idle",
      statusAt: NOW,
    });
    threads.set(CODER_THREAD, [userMessage("old-1", "first"), userMessage("old-2", "second")]);
    const result = await run("dispatch_subagent", {
      agent: "coder",
      brief: "Continue",
      dryRun: true,
      historyMessageIds: ["old-2", "old-1"],
    });
    expect(result).toMatchObject({
      success: true,
      dryRun: true,
      manifest: { history: { mode: "selected", messageIds: ["old-1", "old-2"] } },
    });
    expect(deps.ensureChild).not.toHaveBeenCalled();
    expect(deps.appendMessages).not.toHaveBeenCalled();
    expect(deps.enqueueWorker).not.toHaveBeenCalled();
    expect((await run("dispatch_subagent", { agent: "coder", brief: "Continue" })).success).toBe(
      true
    );
  });

  test("oversized retained history is rejected before scheduling; fresh mode can proceed", async () => {
    const { run, deps, children, threads } = harness();
    children.push({
      threadId: CODER_THREAD,
      agentId: "agent-coder",
      status: "idle",
      statusAt: NOW,
    });
    threads.set(CODER_THREAD, [userMessage("large-old", "captured evidence ".repeat(20_000))]);
    const rejected = await run("dispatch_subagent", { agent: "coder", brief: "Say hello." });
    expect(rejected.success).toBe(false);
    expect(rejected.error).toContain("retained history");
    expect(deps.appendMessages).not.toHaveBeenCalled();
    expect(deps.enqueueWorker).not.toHaveBeenCalled();
    expect(
      (await run("dispatch_subagent", { agent: "coder", brief: "Say hello.", history: "fresh" }))
        .success
    ).toBe(true);
    expect(readSubagentContext(lastMessage(threads, CODER_THREAD))?.history.messageIds).toEqual([]);
  });

  test("history IDs cannot cross subagent boundaries", async () => {
    const { run, deps, children, threads } = harness();
    children.push({
      threadId: CODER_THREAD,
      agentId: "agent-coder",
      status: "idle",
      statusAt: NOW,
    });
    threads.set(CRITIC_THREAD, [userMessage("sibling-id", "private sibling context")]);
    const rejected = await run("dispatch_subagent", {
      agent: "coder",
      brief: "Inspect",
      historyMessageIds: ["sibling-id"],
    });
    expect(rejected.success).toBe(false);
    expect(deps.loadMessages.mock.calls.every(([id]) => id !== CRITIC_THREAD)).toBe(true);
    expect(deps.enqueueWorker).not.toHaveBeenCalled();
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

  test("one turn dispatches at most two independent specialists, even in parallel", async () => {
    const { deps, run } = harness();

    const results = await Promise.all(
      ["coder", "planner", "writer", "critic"].map((agent, i) =>
        run("dispatch_subagent", {
          agent,
          brief: `Task ${i}`,
          additionalDispatchReason: "An independent deliverable explicitly requested by the user.",
        })
      )
    );

    expect(results.filter((r) => r.success)).toHaveLength(2);
    expect(deps.enqueueWorker).toHaveBeenCalledTimes(2);
    expect(deps.ensureChild).toHaveBeenCalledTimes(2);
  });

  test("automatic turns stop after one dispatch across turns until the user speaks", async () => {
    const { memory, run, nextTurn } = harness({ autonomous: true });

    expect(
      (await run("dispatch_subagent", { agent: "coder", brief: "Implement the requested result." }))
        .success
    ).toBe(true);
    nextTurn();
    expect((await run("dispatch_subagent", { agent: "planner", brief: "One more" })).success).toBe(
      false
    );
    expect(memory.current().autonomousDispatches).toBe(1);
  });

  test("without a worktable, automatic turns spend the allowance counted from history", async () => {
    const { deps, run } = harness({ autonomous: true, autonomousRemaining: 2, worktable: "none" });

    expect(
      (await run("dispatch_subagent", { agent: "coder", brief: "Draft the architecture." })).success
    ).toBe(true);
    expect(
      (
        await run("dispatch_subagent", {
          agent: "planner",
          brief: "Plan the slices.",
          additionalDispatchReason: "This has separate dependencies and is independently useful.",
        })
      ).success
    ).toBe(false);
    expect((await run("dispatch_subagent", { agent: "writer", brief: "One more" })).success).toBe(
      false
    );
    expect(deps.enqueueWorker).toHaveBeenCalledTimes(1);
  });

  test("a second specialist needs a reason, and a rejected request spends no dispatch", async () => {
    const { run, deps } = harness();

    await run("dispatch_subagent", { agent: "coder", brief: "Implement the exporter." });
    expect(
      await run("dispatch_subagent", { agent: "writer", brief: "Write the release notes." })
    ).toMatchObject({ success: false });
    expect(deps.enqueueWorker).toHaveBeenCalledTimes(1);
    expect(
      (
        await run("dispatch_subagent", {
          agent: "writer",
          brief: "Write the release notes.",
          additionalDispatchReason: "The user also requested a separate release note deliverable.",
        })
      ).success
    ).toBe(true);
  });

  test("standard tier requires a reason and records the actual queued model", async () => {
    const { run, deps, threads } = harness();
    const brief = "Implement a fault-tolerant encrypted distributed job runner.";

    expect(
      (await run("dispatch_subagent", { agent: "coder", brief, modelTier: "standard" })).success
    ).toBe(false);
    expect(deps.ensureChild).not.toHaveBeenCalled();
    const modelReason =
      "The task requires reasoning across concurrency, encryption and recovery invariants.";
    const result = await run("dispatch_subagent", {
      agent: "coder",
      brief,
      modelTier: "standard",
      modelReason,
    });

    expect(result).toMatchObject({
      success: true,
      modelId: models.anthropic.sonnet.id,
      modelTier: "standard",
    });
    expect(deps.enqueueWorker.mock.calls[0][0].modelId).toBe(result.modelId);
    expect(lastMessage(threads, CODER_THREAD).metadata).toMatchObject({
      modelId: result.modelId,
      modelReason,
    });
  });

  test("busy specialists are left running without queueing another assignment", async () => {
    const { run, deps, children, memory } = harness({ autonomous: true });

    children.push({
      agentId: "agent-coder",
      threadId: CODER_THREAD,
      status: "working",
      statusAt: NOW,
    });
    expect(
      (await run("dispatch_subagent", { agent: "Reed", brief: "Repeat the exporter work." }))
        .success
    ).toBe(false);
    expect(deps.appendMessages).not.toHaveBeenCalled();
    expect(deps.enqueueWorker).not.toHaveBeenCalled();
    expect(memory.current().autonomousDispatches).toBe(0);
  });

  test("identical work cannot be fanned out to another specialist in the same turn", async () => {
    const { run, deps } = harness();
    const brief = "Summarize the existing requirements.";

    await run("dispatch_subagent", { agent: "planner", brief });
    const result = await run("dispatch_subagent", {
      agent: "writer",
      brief,
      additionalDispatchReason: "The same summary should also be written by another specialist.",
    });

    expect(result).toMatchObject({ success: false });
    expect(String(result.error)).toContain("already dispatched");
    expect(deps.enqueueWorker).toHaveBeenCalledTimes(1);
  });

  test("automatic dispatches are counted from heartbeat replies since the user last spoke", () => {
    const dispatchPart = (success: boolean, dryRun = false) =>
      ({
        type: "tool-dispatch_subagent",
        toolCallId: `t-${Math.random()}`,
        state: "output-available",
        input: {},
        output: { success, ...(dryRun ? { dryRun: true } : {}) },
      }) as unknown as UIMessage["parts"][number];
    const assistant = (id: string, parts: UIMessage["parts"]): UIMessage => ({
      id,
      role: "assistant",
      parts,
    });
    const heartbeat = (id: string): UIMessage => ({
      id,
      role: "system",
      parts: [{ type: "text", text: "Lyra finished." }],
    });

    const history: UIMessage[] = [
      heartbeat("h0"),
      assistant("a0", [dispatchPart(true)]),
      userMessage("u1", "Research the options, then draft an architecture."),
      // The user's own turn: not automatic.
      assistant("a1", [dispatchPart(true)]),
      heartbeat("h1"),
      assistant("a2", [dispatchPart(true), dispatchPart(false), dispatchPart(true, true)]),
      heartbeat("h2"),
      assistant("a3", [dispatchPart(true), { type: "text", text: "Started Reed." }]),
    ];

    expect(countAutonomousDispatchesSinceUser(history)).toBe(2);
    expect(countAutonomousDispatchesSinceUser([...history, userMessage("u2", "Thanks")])).toBe(0);
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

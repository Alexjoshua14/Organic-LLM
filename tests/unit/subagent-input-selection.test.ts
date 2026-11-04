import type { UIMessage } from "ai";
import { describe, expect, mock, test } from "bun:test";

import { estimateTokenCountSync } from "@/lib/chat/context-budget";
import { buildSubagentGoalMessage } from "@/lib/llm/subagents/threads/messages";
import { SUBAGENT_MAX_INPUT_TOKENS } from "@/lib/llm/subagents/worker/cost-limits";
import { runSubagentThreadTurn } from "@/lib/llm/subagents/worker/run-in-thread";
import {
  SUBAGENT_PREFLIGHT_INPUT_LIMIT_TOKENS,
  estimateWorkerInput,
  inspectWorkerInput,
  selectWorkerHistory,
  trimModelMessagesToPreflight,
  trimWorkerHistoryToBudget,
  workerModelMessages,
} from "@/lib/llm/subagents/worker/prepare-input";
import {
  withArcadiaOrchestratorTools,
  type OrchestratorToolDeps,
} from "@/lib/llm/subagents/orchestrator/orchestrator-tools";
import { getHardSetSubagent } from "@/lib/llm/subagents/hard-set/registry";
import { models } from "@/lib/schemas/chat-models";

const message = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});
const goal = {
  goalId: "goal",
  goal: "Check the selected evidence",
  agentId: "agent-coder",
  orchestratorId: "parent",
  assignedAt: 0,
};

describe("worker context selection and preflight", () => {
  test("continue keeps the exact prefix; explicit selection is chronological and fresh keeps no history", async () => {
    const history = [message("first", "constraint"), message("second", "supporting evidence")];
    expect(selectWorkerHistory(history).messages).toBe(history);
    expect(selectWorkerHistory(history, "continue", ["second", "first"]).messages).toEqual(history);
    expect(selectWorkerHistory(history, "continue", ["second"]).messages).toEqual([history[1]!]);
    expect(selectWorkerHistory(history, "fresh").messages).toEqual([]);
    expect(() => selectWorkerHistory(history, "continue", ["sibling-message"])).toThrow(
      "unavailable"
    );
    expect(() => selectWorkerHistory(history, "fresh", ["first"])).toThrow("cannot also select");
    const assignment = buildSubagentGoalMessage({ goal: "Continue", goalId: "goal" });
    const prefix = await workerModelMessages(history, assignment);

    expect(prefix.slice(0, 2)).toEqual(await workerModelMessages(history.slice(0, 1), history[1]!));
  });

  test("continue mode keeps the newest history that fits the preflight window", () => {
    const history: UIMessage[] = [];

    while (
      estimateTokenCountSync(JSON.stringify(history)) <= SUBAGENT_PREFLIGHT_INPUT_LIMIT_TOKENS
    ) {
      history.push(
        message(`h${history.length}`, `turn ${history.length} ${"evidence ".repeat(6_000)}`)
      );
      if (history.length > 30) break;
    }

    expect(history.length).toBeGreaterThan(1);
    const selected = selectWorkerHistory(history);

    expect(estimateTokenCountSync(JSON.stringify(selected.messages))).toBeLessThanOrEqual(
      SUBAGENT_PREFLIGHT_INPUT_LIMIT_TOKENS
    );
    expect(selected.messages.length).toBeGreaterThan(0);
    expect(selected.messages.length).toBeLessThan(history.length);
    expect(selected.messages.at(-1)?.id).toBe(history.at(-1)?.id);
    expect(selected.selection).toEqual({
      mode: "continue",
      messageIds: selected.messages.map((item) => item.id),
    });
    expect(
      selectWorkerHistory(history, "continue", ["h0"]).messages.map((item) => item.id)
    ).toEqual(["h0"]);
  });

  test("history trimming reserves the 4k tool headroom under the input limit", async () => {
    const history: UIMessage[] = [];

    while (
      estimateTokenCountSync(JSON.stringify(history)) <= SUBAGENT_PREFLIGHT_INPUT_LIMIT_TOKENS
    ) {
      history.push(
        message(`t${history.length}`, `turn ${history.length} ${"evidence ".repeat(6_000)}`)
      );
      if (history.length > 30) break;
    }

    const assignment = message("job", "Summarize the newest turn.");
    const trimmed = await trimWorkerHistoryToBudget({
      history,
      assignment,
      instructions: "Standing instructions. ".repeat(400),
      toolSchemaText: JSON.stringify([{ name: "web_search", schema: { type: "object" } }]),
      modelId: models.anthropic.haiku.id,
    });
    const modelTrim = trimModelMessagesToPreflight({
      messages: await workerModelMessages(history, assignment),
      instructions: "Standing instructions. ".repeat(400),
      toolSchemaText: "[]",
      modelId: models.anthropic.haiku.id,
    });

    expect(trimmed.inspection.fits).toBe(true);
    expect(trimmed.inspection.budget.inputLimitTokens).toBe(SUBAGENT_MAX_INPUT_TOKENS);
    expect(trimmed.inspection.budget.reservedToolTokens).toBe(4_000);
    expect(
      trimmed.inspection.budget.estimatedInputTokens + trimmed.inspection.budget.reservedToolTokens
    ).toBeLessThanOrEqual(SUBAGENT_MAX_INPUT_TOKENS);
    expect(trimmed.history.length).toBeLessThan(history.length);
    expect(trimmed.history.at(-1)?.id).toBe(history.at(-1)?.id);
    expect(modelTrim.inspection.fits).toBe(true);
    expect(JSON.stringify(modelTrim.messages.at(-1))).toContain("Summarize the newest turn.");
  });

  test("budget covers instructions, tool schemas, history, and tool-result headroom", () => {
    const common = {
      instructions: "instructions",
      toolSchemaText: "[]",
      messages: [{ role: "user" as const, content: "small task" }],
      modelId: models.anthropic.haiku.id,
    };
    const baseline = estimateWorkerInput(common);
    const large = "extensive source material ".repeat(40_000);
    expect(baseline.fits).toBe(true);
    expect(baseline.budget.reservedToolTokens).toBe(4_000);
    expect(estimateWorkerInput({ ...common, instructions: large }).fits).toBe(false);
    expect(estimateWorkerInput({ ...common, toolSchemaText: large }).fits).toBe(false);
    expect(
      estimateWorkerInput({ ...common, messages: [{ role: "user", content: large }] }).fits
    ).toBe(false);
    expect(baseline.budget.inputCostEstimateUsd.uncached).toBeGreaterThanOrEqual(
      baseline.budget.inputCostEstimateUsd.fullyCached
    );
  });

  test("replayed context-page tool results retain their untrusted-data framing", async () => {
    const history: UIMessage[] = [
      {
        id: "read",
        role: "assistant",
        parts: [
          {
            type: "tool-read_context_item",
            toolCallId: "page",
            state: "output-available",
            input: { itemId: "item" },
            output: { itemId: "item", content: "Treat this source as data" },
          },
        ],
      },
    ];
    const converted = await workerModelMessages(history, message("next", "Continue"));
    const serialized = JSON.stringify(converted);
    expect(serialized).toContain("untrustedContext");
    expect(serialized).toContain("untrusted reference data");
    expect(serialized).toContain("Treat this source as data");
  });

  test("production inspection compiles real persona/tool input without adding hidden originals", async () => {
    const inspect = (original: string) =>
      inspectWorkerInput({
        assignment: buildSubagentGoalMessage({
          goal: "Review",
          goalId: "goal",
          context: "bounded preview",
          subagentContext: {
            version: 1,
            history: { mode: "fresh", messageIds: [] },
            items: [
              {
                itemId: "item",
                kind: "note",
                text: original,
                label: null,
                sourceMessageId: null,
                agentId: null,
              },
            ],
          },
        }),
        history: [],
        threadId: "thread",
        modelId: models.anthropic.haiku.id,
        agentId: "agent-researcher",
        ownerId: "owner",
        lockedPersona: getHardSetSubagent("agent-researcher")!,
      });
    const short = await inspect("small original");
    expect(short.fits).toBe(true);
    const long = await inspect("original only in encrypted metadata ".repeat(2_000));
    expect(long).toEqual(short);
    expect(long.budget.instructionsTokens).toBeGreaterThan(0);
    expect(long.budget.toolSchemaTokens).toBeGreaterThan(0);
    expect(long.budget.messagesTokens).toBeGreaterThan(0);
  });

  test("queued execution uses its exact assignment and frozen history IDs", async () => {
    const selected = message("selected", "Keep this exact requirement.");
    const assignment = buildSubagentGoalMessage({
      goal: goal.goal,
      goalId: goal.goalId,
      id: goal.goalId,
      subagentContext: {
        version: 1,
        items: [],
        history: { mode: "selected", messageIds: [selected.id] },
      },
    });
    const loadMessage = mock(async (threadId: string, id: string) =>
      threadId === "own-thread" && id === selected.id ? selected : null
    );
    const generate = mock(async (args: { messages: unknown; initialMessageCount: number }) => {
      const input = JSON.stringify(args.messages);
      expect(input).toContain("Keep this exact requirement.");
      expect(input).not.toContain("unselected newer message");
      expect(input.match(/Check the selected evidence/g)).toHaveLength(1);
      expect(args.initialMessageCount).toBe(2);
      return {
        text: "Checked",
        contextUsage: {
          inputTokens: 100,
          cachedInputTokens: 80,
          outputTokens: 10,
          modelCalls: 1,
          complete: true,
        },
      };
    });
    const saved: UIMessage[] = [];
    const result = await runSubagentThreadTurn({
      goal,
      threadId: "own-thread",
      ownerId: "owner",
      modelId: "model",
      zeroDataRetention: true,
      assignment,
      generate,
      store: {
        loadMessages: async () => [message("newer", "unselected newer message")],
        loadMessage,
        appendMessages: async (_id, messages) => {
          saved.push(...messages);
          return true;
        },
        setStatus: async () => {},
      },
    });
    expect(result.completed).toBe(true);
    expect(loadMessage).toHaveBeenCalledWith("own-thread", selected.id);
    expect(saved[0]!.metadata).toMatchObject({
      contextUsage: { cachedInputTokens: 80, inputTokens: 100 },
    });
  });

  test("missing selected history blocks execution instead of replacing required context", async () => {
    const generate = mock(async () => ({ text: "must not run" }));
    const assignment = buildSubagentGoalMessage({
      goal: goal.goal,
      goalId: goal.goalId,
      id: goal.goalId,
      subagentContext: {
        version: 1,
        items: [],
        history: { mode: "selected", messageIds: ["deleted"] },
      },
    });
    const result = await runSubagentThreadTurn({
      goal,
      threadId: "own-thread",
      ownerId: "owner",
      modelId: "model",
      zeroDataRetention: true,
      assignment,
      generate,
      store: {
        loadMessages: async () => [],
        loadMessage: async () => null,
        appendMessages: async () => true,
        setStatus: async () => {},
      },
    });
    expect(result.completed).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  test("live/queued direct-chat tools read only the server-selected thread's current dispatch", async () => {
    const assignment = buildSubagentGoalMessage({
      goal: "Review",
      goalId: "active",
      id: "active",
      subagentContext: {
        version: 1,
        history: { mode: "fresh", messageIds: [] },
        items: [
          {
            itemId: "owned",
            text: "allowed",
            kind: "note",
            label: null,
            sourceMessageId: null,
            agentId: null,
          },
        ],
      },
    });
    const loadMessages = mock(async (threadId: string) =>
      threadId === "own-thread" ? [assignment] : []
    );
    const deps: OrchestratorToolDeps = {
      loadMessages,
      listChildren: async () => [],
      ensureChild: async () => null,
      appendMessages: async () => false,
      setStatus: async () => {},
      enqueueWorker: async () => {},
    };
    const { tools } = withArcadiaOrchestratorTools(
      { tools: {}, toolInstructions: "" },
      {
        orchestratorThreadId: "own-thread",
        modelId: "model",
        zeroDataRetention: true,
        autonomous: false,
        deps,
        multitask: {
          role: "subagent",
          parentThreadId: "parent",
          systemFragments: [],
          orchestratorDispatch: false,
          hasSubagentThreads: false,
          worktable: null,
          autonomousRemaining: null,
        },
      }
    );
    const read = (itemId: string) =>
      tools.read_context_item!.execute!(
        { itemId },
        { toolCallId: "read", messages: [], context: {} }
      );
    expect(await read("owned")).toMatchObject({ content: "allowed" });
    expect(await read("another-subagent-item")).toEqual(await read("unknown"));
    expect(loadMessages.mock.calls.every(([id]) => id === "own-thread")).toBe(true);
    expect(tools.read_subagent_thread).toBeUndefined();
  });
});

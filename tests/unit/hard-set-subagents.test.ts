import { describe, expect, mock, test } from "bun:test";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import { ARCADIA_HELP_PREFIX } from "@/lib/arcadia/help-response";
import {
  classifyHelpReflex,
  HELP_REFLEX_CONFIDENCE,
  HELP_REFLEX_MAX_CHARS,
  type JevHelpReflexDecide,
} from "@/lib/llm/subagents/hard-set/reflex";
import { getHardSetSubagent, HARD_SET_SUBAGENTS } from "@/lib/llm/subagents/hard-set/registry";
import { buildHelpReflexMessage } from "@/lib/llm/subagents/hard-set/shell";
import { HardSetSubagentSchema } from "@/lib/llm/subagents/hard-set/types";
import { withArcadiaOrchestratorTools } from "@/lib/llm/subagents/orchestrator/orchestrator-tools";
import {
  prepareArcadiaMultitaskTurn,
  type MultitaskTurnDeps,
} from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";

const SHELL_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const agent = HARD_SET_SUBAGENTS[0]!;

describe("hard-set subagent registry", () => {
  test("every definition is valid, unique, and distinct from the orchestrator's roster", () => {
    const rosterIds = new Set(createDemoSubagents().map((a) => a.id));
    const ids = HARD_SET_SUBAGENTS.map((a) => a.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const definition of HARD_SET_SUBAGENTS) {
      expect(HardSetSubagentSchema.safeParse(definition).success).toBe(true);
      expect(rosterIds.has(definition.id)).toBe(false);
      // Would otherwise render as Arcadia's own help card.
      expect(definition.helpMenu.startsWith(ARCADIA_HELP_PREFIX)).toBe(false);
      expect(getHardSetSubagent(definition.id)).toBe(definition);
    }
    expect(getHardSetSubagent("agent-coder")).toBeNull();
  });

  test("the help reflex is a marked assistant message holding the menu", () => {
    const message = buildHelpReflexMessage(agent, "m1");

    expect(message).toMatchObject({
      id: "m1",
      role: "assistant",
      metadata: { source: "subagent-reflex", agentId: agent.id, reflex: "help" },
      parts: [{ type: "text", text: agent.helpMenu }],
    });
  });
});

describe("Jev help reflex", () => {
  const decideWith = (probability: number) =>
    mock<JevHelpReflexDecide>(async () => ({ probability }));

  test("a confident help request gets the reflex; anything less passes through", async () => {
    const yes = await classifyHelpReflex({ text: "help", agent, ownerId: "o", decide: decideWith(0.95) });
    const unsure = await classifyHelpReflex({
      text: "what can you do?",
      agent,
      ownerId: "o",
      decide: decideWith(HELP_REFLEX_CONFIDENCE),
    });

    expect(yes.reflex).toBe(true);
    expect(unsure.reflex).toBe(false);
  });

  test("Jev is called with ZDR forced and only the message and subagent identity", async () => {
    const decide = decideWith(0.1);

    await classifyHelpReflex({ text: "help me design a cache", agent, ownerId: "owner-1", decide });
    const [[call]] = decide.mock.calls;

    expect(call.providerOptions.gateway.zeroDataRetention).toBe(true);
    expect(call.state).toBe(`Subagent: ${agent.name} (${agent.role})\nUser message:\nhelp me design a cache`);
  });

  test("empty, long, and failing checks pass through to a normal turn", async () => {
    const decide = decideWith(0.99);
    const failing = mock<JevHelpReflexDecide>(async () => {
      throw new Error("timeout");
    });

    expect(await classifyHelpReflex({ text: "  ", agent, ownerId: "o", decide })).toMatchObject({
      reflex: false,
      reason: "empty",
    });
    expect(
      await classifyHelpReflex({ text: "x".repeat(HELP_REFLEX_MAX_CHARS + 1), agent, ownerId: "o", decide })
    ).toMatchObject({ reflex: false, reason: "too-long" });
    expect(decide).not.toHaveBeenCalled();
    expect(await classifyHelpReflex({ text: "help", agent, ownerId: "o", decide: failing })).toMatchObject({
      reflex: false,
      reason: "timeout-or-error",
    });
  });
});

describe("hard-set subagent shell turns", () => {
  function deps() {
    return {
      getLink: mock<MultitaskTurnDeps["getLink"]>(async () => null),
      getHardSetShellAgentId: mock(async () => agent.id),
      isMultitaskEnabled: mock(async () => true),
      listChildren: mock<MultitaskTurnDeps["listChildren"]>(async () => []),
      ensureChild: mock(async () => null),
      loadMessages: mock(async () => []),
      appendMessages: mock(async () => true),
      setStatus: mock(async () => {}),
      recordUsage: mock(() => {}),
      enqueueWorker: mock(async () => {}),
    } satisfies MultitaskTurnDeps;
  }

  test("a shell runs as its subagent even with Multiagent on, and never orchestrates", async () => {
    const d = deps();
    const multitask = await prepareArcadiaMultitaskTurn({
      chatId: SHELL_ID,
      ownerId: "owner",
      userText: "Draft an architecture for a job runner.",
      modelId: "m",
      zeroDataRetention: true,
      deps: d,
      orchestratorDispatch: true,
    });

    expect(multitask).toMatchObject({ role: "subagent", hardSetAgentId: agent.id, orchestratorDispatch: false });
    expect(multitask?.systemFragments.join("\n")).toContain(agent.instructions);
    expect(d.isMultitaskEnabled).not.toHaveBeenCalled();
    expect(d.enqueueWorker).not.toHaveBeenCalled();

    const { tools } = withArcadiaOrchestratorTools(
      { tools: {}, toolInstructions: "" },
      {
        multitask,
        orchestratorThreadId: SHELL_ID,
        deps: d,
        modelId: "m",
        zeroDataRetention: true,
        autonomous: false,
      }
    );

    expect(Object.keys(tools)).toEqual([]);
  });

  test("an unknown or retired subagent id falls back to a normal Arcadia thread", async () => {
    const d = deps();

    d.getHardSetShellAgentId.mockResolvedValue("subagent-retired" as never);
    d.isMultitaskEnabled.mockResolvedValue(false);

    expect(
      await prepareArcadiaMultitaskTurn({
        chatId: SHELL_ID,
        ownerId: "owner",
        userText: "hi",
        modelId: "m",
        zeroDataRetention: true,
        deps: d,
      })
    ).toBeNull();
  });
});

import type { UIMessage } from "ai";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";

import { render } from "../helpers/render";

import {
  ActiveSubagentStrip,
  InlineSubagentActivity,
  revealSubagentActivity,
} from "@/components/chat/subagent-activity";
import {
  inlineSubagentDispatch,
  liveAgentForDispatch,
} from "@/lib/arcadia/multitask/inline-dispatches";
import { applyAssignedGoalsToRoster } from "@/lib/arcadia/multitask/apply-awareness";
import { mergeSubagentBoard } from "@/lib/arcadia/multitask/board-sync";
import { buildSubagentThreadSnapshot } from "@/lib/llm/subagents/threads/snapshot";
import {
  buildSubagentGoalMessage,
  buildSubagentReplyMessage,
} from "@/lib/llm/subagents/threads/messages";

import { ArcadiaMultitaskProvider } from "@/app/sandbox/arcadia/_components/multitask-provider";
import { ChatThread } from "@/components/chat/chat-thread";
import { Conversation } from "@/components/third-party/ai-elements/conversation";

afterEach(cleanup);

const agent: ArcadiaSubagent = {
  id: "agent-coder",
  name: "Reed",
  role: "coder",
  blurb: "Implements the slice",
  goal: "Review keyboard navigation",
  progress: "Checking focus order",
  progressPct: 20,
  status: "working",
  milestones: [],
  voiceId: "coral",
  threadId: "child",
  latestGoalId: "goal-1",
};
const output = {
  success: true,
  agentId: agent.id,
  name: agent.name,
  goalId: "goal-1",
  threadId: "child",
};
const part = {
  type: "tool-dispatch_subagent",
  toolCallId: "call-1",
  state: "output-available",
  input: { brief: agent.goal },
  output,
} as UIMessage["parts"][number];
const dispatch = inlineSubagentDispatch(part)!;

describe("inline subagent assignments", () => {
  test("accepts static and dynamic completed dispatches, never previews, failures, or partial calls", () => {
    expect(dispatch.brief).toBe(agent.goal);
    expect(
      inlineSubagentDispatch({
        ...part,
        type: "dynamic-tool",
        toolName: "dispatch_subagent",
      } as UIMessage["parts"][number])?.goalId
    ).toBe("goal-1");
    for (const patch of [
      { output: { ...output, dryRun: true } },
      { output: { ...output, success: false } },
      { output: { success: true } },
      { output: null },
      { state: "input-available" },
      { state: "output-error", errorText: "Failed" },
      { type: "tool-worktable" },
    ]) {
      expect(
        inlineSubagentDispatch({ ...part, ...patch } as UIMessage["parts"][number])
      ).toBeNull();
    }
  });

  test("reusing the same specialist never assigns new progress to an older dispatch", () => {
    expect(liveAgentForDispatch(dispatch, [agent])).toBe(agent);
    expect(liveAgentForDispatch(dispatch, [{ ...agent, latestGoalId: "goal-2" }])).toBeUndefined();
    expect(liveAgentForDispatch(dispatch, [{ ...agent, latestGoalId: null }])).toBeUndefined();
    const [next] = applyAssignedGoalsToRoster(
      [agent],
      [{ agentId: agent.id, goalId: "goal-2", goal: "Review mobile", threadId: "child" }]
    );
    expect(next?.latestGoalId).toBe("goal-2");
    expect(next?.progress).not.toBe(agent.progress);
  });

  test("assignment identity survives persisted snapshots and board refreshes", () => {
    const row = { threadId: "child", agentId: agent.id, status: "done", statusAt: null };
    const goal = buildSubagentGoalMessage({ goal: agent.goal, goalId: "goal-1" });
    const reply = buildSubagentReplyMessage({
      text: "Checked all focus targets",
      goalId: "goal-1",
      modelId: "test-model",
    });
    for (const messages of [[goal, reply], [reply]]) {
      const snapshot = buildSubagentThreadSnapshot(row, messages);
      expect(snapshot.latestGoalId).toBe("goal-1");
      const [merged] = mergeSubagentBoard(
        [agent],
        [{ ...snapshot, goal: snapshot.lastGoal, outcome: snapshot.lastOutcome }]
      );
      expect(merged?.latestGoalId).toBe("goal-1");
      expect(merged?.status).toBe("done");
    }
    const direct: UIMessage = {
      id: "direct",
      role: "user",
      parts: [{ type: "text", text: "New unrelated task" }],
    };
    expect(buildSubagentThreadSnapshot(row, [goal, reply, direct]).latestGoalId).toBeNull();
  });

  test("the strip reveals and focuses the row, then removes completed work without losing its result", () => {
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = () => {};
    try {
      function Fixture({ current }: { current: ArcadiaSubagent }) {
        return (
          <>
            <ActiveSubagentStrip
              agents={[current]}
              onReveal={() => revealSubagentActivity("activity-row")}
            />
            <InlineSubagentActivity id="activity-row" dispatch={dispatch} agent={current} />
          </>
        );
      }
      const app = render(<Fixture current={agent} />);
      const details = app.container.querySelector("details")!;
      expect(details.open).toBe(false);
      fireEvent.click(app.getByRole("button", { name: "Show Reed: Working" }));
      expect(details.open).toBe(true);
      expect(document.activeElement).toBe(details.querySelector("summary"));
      app.rerender(
        <Fixture current={{ ...agent, status: "done", progress: "All focus targets checked" }} />
      );
      expect(app.queryByRole("navigation", { name: "Active subagents" })).toBeNull();
      expect(details.open).toBe(true);
      expect(app.getByText("Done")).toBeTruthy();
      expect(app.getAllByText("All focus targets checked").length).toBeGreaterThan(0);
      expect(app.getByRole("link", { name: "Open conversation" }).getAttribute("href")).toBe(
        "/sandbox/arcadia/child"
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll;
    }
  });

  test("blocked work stays visible, idle roster slots do not, and historical rows do not claim completion", () => {
    const app = render(
      <>
        <ActiveSubagentStrip
          agents={[
            { ...agent, status: "blocked" },
            { ...agent, id: "unused", name: "Unused", status: "idle" },
          ]}
          onReveal={() => {}}
        />
        <InlineSubagentActivity id="older-row" dispatch={dispatch} />
      </>
    );
    expect(app.getByRole("button", { name: "Show Reed: Needs attention" })).toBeTruthy();
    expect(app.queryByText("Unused")).toBeNull();
    expect(app.getByText("Sent")).toBeTruthy();
    expect(app.queryByText("Done")).toBeNull();
  });
});

describe("subagents inside the conversation", () => {
  test.each(["parent", "child", "unrelated"])(
    "only the owning orchestrator renders live rows (%s)",
    async (chatId) => {
      const originalFetch = globalThis.fetch;
      const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      globalThis.fetch = (async () =>
        Response.json({
          enabled: false,
          activeStreamId: null,
          subagents: [{ ...agent, agentId: agent.id, statusAt: null, outcome: null }],
        })) as typeof fetch;
      try {
        let app!: ReturnType<typeof render>;
        await act(async () => {
          app = render(
            <ArcadiaMultitaskProvider
              threadId={chatId === "child" ? "child" : "parent"}
              orchestratorThreadId="parent"
              viewingSubagentId={chatId === "child" ? agent.id : undefined}
              initialHasSubagentThreads
            >
              <Conversation>
                <ChatThread
                  chatId={chatId}
                  messages={[{ id: "dispatch-message", role: "assistant", parts: [part] }]}
                  showActions={false}
                />
              </Conversation>
            </ArcadiaMultitaskProvider>
          );
        });
        if (chatId === "parent") {
          const strip = app.getByRole("navigation", { name: "Active subagents" });
          expect(strip.closest(".conversation-scroll")).toBeNull();
          const details = app.container.querySelector("details");
          expect(details?.closest(".conversation-scroll")).toBeTruthy();
          // Owning orchestrator replaces the tool chip with InlineSubagentActivity.
          expect(
            app.container.querySelector('[data-organic-tool-presence="dispatch_subagent"]')
          ).toBeNull();
          expect(app.getByRole("link", { name: "Open conversation" })).toBeTruthy();
        } else {
          expect(app.queryByRole("navigation", { name: "Active subagents" })).toBeNull();
          // Non-owning views keep the OrganicToolCallPresence chip (tool name is not visible text).
          const presence = app.container.querySelector(
            '[data-organic-tool-presence="dispatch_subagent"]'
          );
          expect(presence).toBeTruthy();
          expect(presence?.getAttribute("data-tool-state")).toBe("complete");
        }
      } finally {
        cleanup();
        globalThis.fetch = originalFetch;
        if (originalVisibility)
          Object.defineProperty(document, "visibilityState", originalVisibility);
        else Reflect.deleteProperty(document, "visibilityState");
      }
    }
  );
});

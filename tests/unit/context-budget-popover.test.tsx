import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, within } from "@testing-library/react";

import { ContextBudgetPopover } from "@/components/chat/context-budget-indicator";
import { finalizeContextBudget } from "@/lib/chat/context-budget";
import { render } from "../helpers/render";

afterEach(cleanup);

const budget = finalizeContextBudget({
  modelId: "openai/gpt-6-sol",
  contextMessageLimit: 10,
  packedMessageCount: 2,
  totalThreadMessages: 2,
  includesRollingSummary: false,
  segments: [
    { id: "messages", label: "Thread messages", tokens: 100, color: "" },
    { id: "system", label: "System prompt", tokens: 300, color: "" },
  ],
  lastTurn: {
    inputTokens: 999,
    memoriesInjected: 50,
    memoryTokens: 900,
    usage: {
      inputTokens: 250,
      cachedInputTokens: 160,
      outputTokens: 40,
      costUsd: 0.003,
      costSource: "gateway",
      modelCalls: 2,
      complete: true,
    },
  },
  memoryContext: [
    { id: "a", messageId: "u", source: "automatic" },
    { id: "a", messageId: "a", source: "tool" },
    { id: "b", messageId: "a", source: "tool" },
  ],
});

test("puts deduplicated memories in context and actual usage in last send", () => {
  const view = render(<ContextBudgetPopover budget={budget} />);
  const last = within(view.getByRole("region", { name: "Last send" }));
  const context = within(view.getByRole("region", { name: "In context" }));

  expect(last.getByText("250 tok")).toBeTruthy();
  expect(last.getByText("160 tok")).toBeTruthy();
  expect(last.getByText("40 tok")).toBeTruthy();
  expect(last.getByText("$0.0030")).toBeTruthy();
  expect(last.queryByText("Memories")).toBeNull();
  expect(view.queryByText("Memories injected")).toBeNull();
  expect(context.getByText("Memories")).toBeTruthy();
  expect(context.getByText("Memories").parentElement?.textContent).toBe("Memories2");
  expect(context.getByText("Automatic retrieval").parentElement?.textContent).toBe(
    "Automatic retrieval1"
  );
  expect(context.getByText("Fetched by tools").parentElement?.textContent).toBe(
    "Fetched by tools2"
  );
  expect(view.queryByText("Memories by message")).toBeNull();
  expect(context.getByText(/counted once in the total/)).toBeTruthy();
});

test("one compact bar reveals a section's tokens on hover or tap without an instruction", () => {
  const view = render(<ContextBudgetPopover budget={budget} />);

  expect(view.queryByText(/Hover or tap/)).toBeNull();
  expect(view.getByRole("status").textContent).toBe("");
  fireEvent.mouseEnter(view.getByRole("button", { name: "Thread messages: 100 estimated tokens" }));
  expect(within(view.getByRole("status")).getByText("Thread messages")).toBeTruthy();
  expect(view.getByRole("status").textContent).toContain("100 tok · 25%");
  fireEvent.click(view.getByRole("button", { name: "System prompt: 300 estimated tokens" }));
  expect(within(view.getByRole("status")).getByText("System prompt")).toBeTruthy();
  expect(view.getByRole("status").textContent).toContain("300 tok · 75%");
  fireEvent.mouseLeave(view.getByRole("button", { name: "System prompt: 300 estimated tokens" }));
  expect(view.getByRole("status").textContent).toBe("");
});

test("groups enabled tools into capability pills", () => {
  const view = render(
    <ContextBudgetPopover
      budget={{
        ...budget,
        activeToolNames: [
          "search_memories",
          "list_recent_memories",
          "web_search",
          "get_more_chat_history",
          "get_full_chat_history",
          "manage_tasks",
          "make_mermaid_diagram",
          "render_gen_ui",
          "gather_restaurant",
          "mise_plan",
          "fetch_recipe",
        ],
      }}
    />
  );
  const pills = within(view.getByRole("list", { name: "Enabled tool categories" }));

  expect(pills.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "Memory",
    "Web",
    "Chat history",
    "Task management",
    "Diagrams",
    "Interactive content",
    "Restaurants",
    "Meal planning",
  ]);
  expect(view.queryByText("search_memories")).toBeNull();
});

test("unreported usage stays unavailable, and estimated cost is labeled", () => {
  const view = render(
    <ContextBudgetPopover
      budget={{
        ...budget,
        lastTurn: {
          ...budget.lastTurn!,
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            modelCalls: 1,
            complete: false,
            costUsd: 0.004,
            costSource: "estimate",
          },
        },
      }}
    />
  );
  const last = within(view.getByRole("region", { name: "Last send" }));

  expect(last.getByText("Not reported")).toBeTruthy();
  expect(last.getByText("~$0.0040")).toBeTruthy();
  expect(last.getByText(/So far across 1 model call/)).toBeTruthy();
  expect(last.getByText(/Cost is estimated/)).toBeTruthy();
});

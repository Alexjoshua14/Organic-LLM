import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useRef } from "react";

import { DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";
import { coreInputScopes } from "@/lib/core-input/scopes";
import type { ChatModel } from "@/lib/schemas/chat";

import { installBrowserMedia } from "../helpers/browser-media";

let restoreMedia: () => void;
let stored: [string, string][];
beforeEach(() => {
  restoreMedia = installBrowserMedia();
  stored = Object.entries(localStorage);
});

const clerk = { ...(await import("@clerk/nextjs")) };
const chat = { ...(await import("@/lib/context/chat-context")) };
mock.module("@clerk/nextjs", () => ({
  ...clerk,
  useUser: () => ({ user: null }),
  useAuth: () => ({ isLoaded: true, userId: null }),
}));
mock.module("@/lib/context/chat-context", () => ({
  ...chat,
  useSharedChatContext: () => ({ refreshSidebarChats: () => undefined }),
}));
const { CoreInput } = await import("@/components/chat/core-input");
const { Stage } = await import("@/components/stage/stage");
const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  restoreMedia();
  localStorage.clear();
  for (const [key, value] of stored) localStorage.setItem(key, value);
});
afterAll(() => {
  mock.module("@clerk/nextjs", () => clerk);
  mock.module("@/lib/context/chat-context", () => chat);
});

const scope = coreInputScopes.area("stage-beta-test");
const send = mock(async (_message: unknown) => undefined);
function Composer({ variant = "stage-beta" }: { variant?: "default" | "stage-beta" }) {
  const model = useRef<ChatModel>(DEFAULT_COMPOSER_MODEL);
  const search = useRef(false);
  const memory = useRef(false);
  const speech = useRef(false);
  return (
    <CoreInput
      variant={variant}
      snapshotScope={scope}
      modelRef={model}
      useWebSearchRef={search}
      useMemoriesRef={memory}
      useSpeechFriendlyRef={speech}
      sendMessage={send}
      stop={async () => undefined}
      status="ready"
      featureHints={false}
      showContextBudget={false}
      defaultWebSearch={false}
      defaultMemories={false}
      voiceControl={<button type="button">Start voice session</button>}
    />
  );
}

test("beta sends a multiline draft through CoreInput while keeping voice and options available", async () => {
  send.mockClear();
  const app = render(<Composer />);
  const input = app.getByRole("textbox", { name: "Message Organic" });
  expect(input.getAttribute("aria-multiline")).toBe("true");
  expect(app.getByRole("button", { name: "Composer options" })).toBeTruthy();
  expect(app.getByRole("button", { name: "Start voice session" })).toBeTruthy();
  const submit = app.getByRole("button", { name: "Send message" });
  expect(submit.querySelector("circle")).toBeNull();
  expect(submit.className).not.toContain("organic-glass-preview");
  fireEvent.change(input, { target: { value: "First thought\nAnd a second line" } });
  fireEvent.click(app.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send.mock.calls[0]?.[0]).toMatchObject({ text: "First thought\nAnd a second line" });
});

test("mounting Stage beta does not reset global composer preferences", () => {
  localStorage.setItem("organic-llm-web-search", "true");
  localStorage.setItem("organic-llm-speech-friendly", "true");
  localStorage.setItem("organic-llm-prefs-timestamp", "expired");
  render(<Composer />);
  expect(localStorage.getItem("organic-llm-web-search")).toBe("true");
  expect(localStorage.getItem("organic-llm-speech-friendly")).toBe("true");
  expect(localStorage.getItem("organic-llm-prefs-timestamp")).toBe("expired");
});

test("default CoreInput keeps its existing layout and never adds beta controls", () => {
  const app = render(<Composer variant="default" />);
  expect(app.container.querySelector(".core-input-stage-beta")).toBeNull();
  expect(app.queryByRole("button", { name: "Composer options" })).toBeNull();
  expect(app.queryByRole("button", { name: "Start voice session" })).toBeNull();
});

test("Stage returns to centered Organic, retains tucked pieces and applies server navigation once", async () => {
  const { emptyStageState } = await import("@/lib/stage/schema");
  const { stageNavigation } = await import("@/lib/stage/views");
  const source = { id: crypto.randomUUID(), name: "Prep Planner" };
  let state = {
    ...emptyStageState(),
    widgets: [
      {
        id: crypto.randomUUID(),
        kind: "note" as const,
        title: "Prep checklist",
        text: "Chop the onion",
        rect: { x: 8, y: 4, w: 11, h: 16 },
        source,
      },
    ],
    messages: [
      { id: crypto.randomUUID(), role: "assistant" as const, text: "The plan is ready." },
      {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        text: "Prep is ready.",
        author: { ...source, kind: "subagent" as const },
      },
    ],
  };
  const requests: any[] = [];
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      requests.push(body);
      state = {
        ...state,
        revision: state.revision + 1,
        viewCommand: { id: body.requestId, target: stageNavigation(body.message, state)! },
      } as typeof state;
    }
    return Response.json({ state });
  }) as typeof fetch;
  const app = render(<Stage />);
  await waitFor(() =>
    expect(Boolean(app.queryByRole("button", { name: /Prep Planner/ }))).toBe(true)
  );
  expect(Boolean(app.queryByRole("article", { name: "Prep checklist" }))).toBe(false);
  expect(
    app.container.querySelector<HTMLElement>('[data-agent-id="organic"]')?.style.gridColumn
  ).toBe("13 / span 8");
  fireEvent.click(app.getByRole("button", { name: /Prep Planner/ }));
  const piece = app.getByRole("article", { name: "Prep checklist" });
  fireEvent.click(app.getByRole("button", { name: "Organic", exact: true }));
  expect(piece.hasAttribute("hidden")).toBe(true);
  expect(piece.isConnected).toBe(true);
  fireEvent.click(app.getByRole("button", { name: /Prep Planner/ }));
  expect(app.getByRole("article", { name: "Prep checklist" }) === piece).toBe(true);
  fireEvent.change(app.getByRole("textbox", { name: "Message Organic" }), {
    target: { value: "show me Organic" },
  });
  fireEvent.click(app.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(piece.hasAttribute("hidden")).toBe(true));
  expect(requests).toHaveLength(1);
  expect(requests[0].settings.presentation.view).toEqual({ kind: "author", id: source.id });
  expect(
    app.container.querySelector<HTMLElement>('[data-agent-id="organic"]')?.style.gridColumn
  ).toBe("13 / span 8");
  fireEvent.click(app.getByRole("button", { name: /Prep Planner/ }));
  window.dispatchEvent(new Event("focus"));
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(piece.hasAttribute("hidden")).toBe(false);
  expect(requests).toHaveLength(1);
  const { STAGE_VIEW_EVENT } = await import("@/lib/stage/view-schema");
  const command = { id: crypto.randomUUID(), target: { kind: "organic", id: null } };
  fireEvent(window, new CustomEvent(STAGE_VIEW_EVENT, { detail: command }));
  expect(piece.hasAttribute("hidden")).toBe(true);
  fireEvent.click(app.getByRole("button", { name: /Prep Planner/ }));
  fireEvent(window, new CustomEvent(STAGE_VIEW_EVENT, { detail: command }));
  expect(piece.hasAttribute("hidden")).toBe(false);
});

test("saved placement is identical after closing inspection, hiding guides, switching views and reloading", async () => {
  const { emptyStageState } = await import("@/lib/stage/schema");
  const { applyStageOperations } = await import("@/lib/stage/layout");
  const source = { id: crypto.randomUUID(), name: "Prep Planner" };
  let state = {
    ...emptyStageState(),
    widgets: [
      {
        id: crypto.randomUUID(),
        kind: "note" as const,
        title: "Prep checklist",
        text: "Saved work",
        rect: { x: 8, y: 4, w: 11, h: 16 },
        source,
      },
    ],
    messages: [
      {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        text: "Ready",
        author: { ...source, kind: "subagent" as const },
      },
    ],
  };
  const patches: unknown[] = [];
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      patches.push(body);
      if (body.revision !== state.revision)
        return Response.json({ error: "Stage changed" }, { status: 409 });
      state = {
        ...state,
        revision: state.revision + 1,
        widgets: applyStageOperations(state.widgets, body.operations),
      } as typeof state;
    }
    return Response.json({ state });
  }) as typeof fetch;
  const app = render(<Stage />);
  await waitFor(() =>
    expect(Boolean(app.queryByRole("button", { name: /Prep Planner/ }))).toBe(true)
  );
  fireEvent.click(app.getByRole("button", { name: /Prep Planner/ }));
  fireEvent.click(app.getByRole("button", { name: "Show grid" }));
  fireEvent.click(app.getByRole("button", { name: "Arrange Prep checklist" }));
  fireEvent.change(app.getByLabelText("Column"), { target: { value: "16" } });
  fireEvent.change(app.getByLabelText("Row"), { target: { value: "6" } });
  const piece = app.getByRole("article", { name: "Prep checklist" });
  await waitFor(() => expect(piece.style.gridColumn).toBe("16 / span 11"));
  expect(piece.style.gridRow).toBe("6 / span 16");
  fireEvent.click(app.getByRole("button", { name: "Place it" }));
  await waitFor(() =>
    expect(Boolean(app.queryByRole("dialog", { name: "Arrange Prep checklist" }))).toBe(false)
  );
  expect(patches).toHaveLength(1);
  expect(state.widgets[0].rect).toEqual({ x: 15, y: 5, w: 11, h: 16 });
  fireEvent.click(app.getByRole("button", { name: "Show grid" }));
  expect(piece.style.gridColumn).toBe("16 / span 11");
  expect(piece.style.gridRow).toBe("6 / span 16");
  fireEvent.click(app.getByRole("button", { name: "Organic", exact: true }));
  fireEvent.click(app.getByRole("button", { name: /Prep Planner/ }));
  expect(piece.style.gridColumn).toBe("16 / span 11");
  app.unmount();
  const reloaded = render(<Stage />);
  await waitFor(() =>
    expect(Boolean(reloaded.queryByRole("button", { name: /Prep Planner/ }))).toBe(true)
  );
  fireEvent.click(reloaded.getByRole("button", { name: /Prep Planner/ }));
  const restored = reloaded.getByRole("article", { name: "Prep checklist" });
  expect(restored.style.gridColumn).toBe("16 / span 11");
  expect(restored.style.gridRow).toBe("6 / span 16");
});

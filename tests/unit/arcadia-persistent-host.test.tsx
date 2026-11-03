import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Fragment, useEffect, type ReactNode } from "react";

import {
  ArcadiaPersistentHost,
  ArcadiaThreadMeta,
} from "@/app/sandbox/arcadia/_components/multitask-host";
import { useArcadiaMultitask, type ArcadiaMultitaskValue } from "@/app/sandbox/arcadia/_components/multitask-provider";
import { SidebarProvider } from "@/components/third-party/ui/sidebar";
import { FeatureHintRegistryProvider } from "@/lib/onboarding/feature-hint-context";

import { AppRouterProvider, appRouter } from "../helpers/app-router";
import "../helpers/render";

const ORCHESTRATOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBAGENT_THREAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_ORCHESTRATOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
let mounts = 0;
let seen: { threadId: string; viewing: string | null; selectedId: string | null } | null = null;
let board: ArcadiaMultitaskValue | null = null;

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: false,
      addEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      removeEventListener: () => {},
    }),
  });
  mounts = 0;
  seen = null;
  board = null;
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json({ enabled: false, activeStreamId: null })
  );
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();

  if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
  else delete (window as Partial<Window>).matchMedia;
});

/** Stands in for the thread page's Chat: counts mounts and reports the board context. */
function Probe() {
  const ctx = useArcadiaMultitask();

  useEffect(() => {
    mounts += 1;
  }, []);
  board = ctx;
  seen = { threadId: ctx.threadId, viewing: ctx.viewingSubagentId, selectedId: ctx.selectedId };

  return <p>thread</p>;
}

/** Next remounts everything under `[slug]` when the slug changes, so key each page by thread. */
function Page({
  threadId,
  orchestratorThreadId,
  viewingSubagentId,
  hasSubagents = true,
  view = false,
}: {
  threadId: string;
  orchestratorThreadId: string;
  viewingSubagentId?: string;
  hasSubagents?: boolean;
  view?: boolean;
}) {
  return (
    <Fragment key={threadId}>
      <ArcadiaThreadMeta
        initialHasSubagentThreads={hasSubagents}
        initialMultitaskView={view}
        orchestratorThreadId={orchestratorThreadId}
        threadId={threadId}
        viewingSubagentId={viewingSubagentId}
      />
      <Probe />
    </Fragment>
  );
}

function App({ children }: { children: ReactNode }) {
  return (
    <AppRouterProvider>
      <FeatureHintRegistryProvider>
        <SidebarProvider>
          <ArcadiaPersistentHost>{children}</ArcadiaPersistentHost>
        </SidebarProvider>
      </FeatureHintRegistryProvider>
    </AppRouterProvider>
  );
}

const layout = (container: HTMLElement) => container.querySelector("[data-arcadia-multitask-layout]");

test("switching to a subagent thread swaps the thread and keeps the board", async () => {
  const app = render(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={ORCHESTRATOR} />
    </App>
  );

  await waitFor(() => expect(seen?.threadId).toBe(ORCHESTRATOR));
  const host = layout(app.container);

  expect(host).not.toBeNull();

  app.rerender(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={SUBAGENT_THREAD} viewingSubagentId="agent-researcher" />
    </App>
  );

  await waitFor(() =>
    expect(seen).toEqual({ threadId: SUBAGENT_THREAD, viewing: "agent-researcher", selectedId: "agent-researcher" })
  );
  expect(layout(app.container)).toBe(host);
  // One Chat per thread, and no extra remount from the board.
  expect(mounts).toBe(2);
});

test("returning to the orchestrator thread unselects the subagent", async () => {
  const app = render(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={SUBAGENT_THREAD} viewingSubagentId="agent-researcher" />
    </App>
  );

  await waitFor(() => expect(seen?.selectedId).toBe("agent-researcher"));

  app.rerender(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={ORCHESTRATOR} />
    </App>
  );

  await waitFor(() =>
    expect(seen).toEqual({ threadId: ORCHESTRATOR, viewing: null, selectedId: null })
  );
  expect(mounts).toBe(2);
});

test("a different orchestrator starts a clean board without remounting the host or the page twice", async () => {
  const app = render(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={ORCHESTRATOR} />
    </App>
  );

  await waitFor(() => expect(board?.orchestratorThreadId).toBe(ORCHESTRATOR));
  const host = layout(app.container);

  act(() => board?.selectAgent("agent-researcher"));
  expect(board?.sendTarget).toEqual({ kind: "subagent", agentId: "agent-researcher" });

  app.rerender(
    <App>
      <Page orchestratorThreadId={OTHER_ORCHESTRATOR} threadId={OTHER_ORCHESTRATOR} />
    </App>
  );

  await waitFor(() => expect(board?.orchestratorThreadId).toBe(OTHER_ORCHESTRATOR));
  expect(board?.sendTarget).toEqual({ kind: "orchestrator" });
  expect(layout(app.container)).toBe(host);
  expect(mounts).toBe(2);
});

test("the first registration fills in the host's guess without remounting the page", async () => {
  render(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={SUBAGENT_THREAD} viewingSubagentId="agent-researcher" />
    </App>
  );

  await waitFor(() => expect(seen?.threadId).toBe(SUBAGENT_THREAD));
  expect(board?.orchestratorThreadId).toBe(ORCHESTRATOR);
  expect(mounts).toBe(1);
});

test("a thread the server says has no workers makes no board or discovery requests", async () => {
  render(
    <App>
      <Page hasSubagents={false} orchestratorThreadId={ORCHESTRATOR} threadId={ORCHESTRATOR} />
    </App>
  );

  await waitFor(() => expect(seen?.threadId).toBe(ORCHESTRATOR));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  expect(fetchSpy).not.toHaveBeenCalled();
});

test("the header keeps the recipient picker in a subagent thread and switches chats from it", async () => {
  appRouter.calls.length = 0;
  const app = render(
    <App>
      <Page
        orchestratorThreadId={ORCHESTRATOR}
        threadId={SUBAGENT_THREAD}
        view
        viewingSubagentId="agent-researcher"
      />
    </App>
  );

  const group = await waitFor(() => app.getByRole("group", { name: "Message recipient" }));

  expect(app.queryByText("Back to orchestrator")).toBeNull();
  expect(
    within(group).getByRole("button", { name: "Lyra", pressed: true, hidden: true })
  ).toBeTruthy();

  // Open the picker, then pick Orchestrator: back to the orchestrator thread, nothing selected.
  fireEvent.click(within(group).getByRole("button", { name: "Lyra", hidden: true }));
  fireEvent.click(within(group).getByRole("button", { name: "Orchestrator", hidden: true }));

  expect(appRouter.calls).toEqual([{ method: "replace", href: `/sandbox/arcadia/${ORCHESTRATOR}` }]);
  expect(board?.selectedId).toBeNull();
});

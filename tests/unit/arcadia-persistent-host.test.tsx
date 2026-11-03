import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";

import {
  ArcadiaPersistentHost,
  ArcadiaThreadMeta,
} from "@/app/sandbox/arcadia/_components/multitask-host";
import { useArcadiaMultitask } from "@/app/sandbox/arcadia/_components/multitask-provider";
import { SidebarProvider } from "@/components/third-party/ui/sidebar";

import "../helpers/render";

const ORCHESTRATOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBAGENT_THREAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_ORCHESTRATOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
let mounts = 0;
let seen: { threadId: string; viewing: string | null; selectedId: string | null } | null = null;

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
  const { threadId, viewingSubagentId, selectedId } = useArcadiaMultitask();

  useEffect(() => {
    mounts += 1;
  }, []);
  seen = { threadId, viewing: viewingSubagentId, selectedId };

  return <p>thread</p>;
}

function Page({
  threadId,
  orchestratorThreadId,
  viewingSubagentId,
}: {
  threadId: string;
  orchestratorThreadId: string;
  viewingSubagentId?: string;
}) {
  return (
    <>
      <ArcadiaThreadMeta
        initialHasSubagentThreads
        initialMultitaskView={false}
        orchestratorThreadId={orchestratorThreadId}
        threadId={threadId}
        viewingSubagentId={viewingSubagentId}
      />
      <Probe />
    </>
  );
}

function App({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ArcadiaPersistentHost>{children}</ArcadiaPersistentHost>
    </SidebarProvider>
  );
}

test("switching to a subagent thread updates the board context without remounting the host", async () => {
  const app = render(
    <App>
      <Page threadId={ORCHESTRATOR} orchestratorThreadId={ORCHESTRATOR} />
    </App>
  );

  await waitFor(() => expect(seen?.threadId).toBe(ORCHESTRATOR));
  const board = app.container.querySelector("[data-arcadia-multitask-layout]");

  expect(board).not.toBeNull();

  app.rerender(
    <App>
      <Page
        orchestratorThreadId={ORCHESTRATOR}
        threadId={SUBAGENT_THREAD}
        viewingSubagentId="lyra"
      />
    </App>
  );

  await waitFor(() => expect(seen).toEqual({ threadId: SUBAGENT_THREAD, viewing: "lyra", selectedId: "lyra" }));
  expect(app.container.querySelector("[data-arcadia-multitask-layout]")).toBe(board);
  expect(mounts).toBe(1);
});

test("returning to the orchestrator thread unselects the subagent", async () => {
  const app = render(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={SUBAGENT_THREAD} viewingSubagentId="lyra" />
    </App>
  );

  await waitFor(() => expect(seen?.selectedId).toBe("lyra"));

  app.rerender(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={ORCHESTRATOR} />
    </App>
  );

  await waitFor(() => expect(seen).toEqual({ threadId: ORCHESTRATOR, viewing: null, selectedId: null }));
  expect(mounts).toBe(1);
});

test("a different orchestrator is a different board and remounts the host", async () => {
  const app = render(
    <App>
      <Page threadId={ORCHESTRATOR} orchestratorThreadId={ORCHESTRATOR} />
    </App>
  );

  await waitFor(() => expect(seen?.threadId).toBe(ORCHESTRATOR));
  app.rerender(
    <App>
      <Page threadId={OTHER_ORCHESTRATOR} orchestratorThreadId={OTHER_ORCHESTRATOR} />
    </App>
  );

  await waitFor(() => expect(seen?.threadId).toBe(OTHER_ORCHESTRATOR));
  expect(mounts).toBe(2);
});

test("the first registration fills in the host's guess without remounting it", async () => {
  render(
    <App>
      <Page orchestratorThreadId={ORCHESTRATOR} threadId={SUBAGENT_THREAD} viewingSubagentId="lyra" />
    </App>
  );

  await waitFor(() => expect(seen?.threadId).toBe(SUBAGENT_THREAD));
  expect(mounts).toBe(1);
});

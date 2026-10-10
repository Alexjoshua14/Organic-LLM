import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { SendTargetPicker } from "@/app/sandbox/arcadia/_components/send-target-picker";
import { SubagentSwipeRow } from "@/app/sandbox/arcadia/_components/subagent-swipe-row";
import { MultitaskDashboard } from "@/app/sandbox/arcadia/_components/multitask-dashboard";
import { ArcadiaMultitaskProvider } from "@/app/sandbox/arcadia/_components/multitask-provider";
import { SidebarProvider } from "@/components/third-party/ui/sidebar";
import type { ArcadiaMultitaskSendTarget } from "@/lib/arcadia/multitask/layout-mode";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import { render } from "../helpers/render";

afterEach(cleanup);
const agents: ArcadiaSubagent[] = [
  {
    id: "lyra",
    name: "Lyra",
    role: "Researcher",
    blurb: "Researches sources",
    goal: "Review",
    progress: "Reading sources",
    progressPct: 30,
    status: "working",
    milestones: [],
    voiceId: "coral",
    modelId: "anthropic/claude-sonnet-4.6",
  },
];

describe("mobile multiagent controls", () => {
  test("mobile Chat and Agents navigation keeps the draft mounted", async () => {
    const previousFetch = globalThis.fetch;
    const previousMedia = window.matchMedia;
    globalThis.fetch = (async () =>
      Response.json({ enabled: true, activeStreamId: null, subagents: [] })) as typeof fetch;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
      onchange: null,
    })) as typeof window.matchMedia;
    try {
      let app!: ReturnType<typeof render>;
      await act(async () => {
        app = render(
          <SidebarProvider>
            <ArcadiaMultitaskProvider
              threadId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
              initialMultitaskView
            >
              <MultitaskDashboard>
                <input aria-label="Draft" defaultValue="Keep this draft" />
              </MultitaskDashboard>
            </ArcadiaMultitaskProvider>
          </SidebarProvider>
        );
      });
      const draft = app.getByRole("textbox", { name: "Draft" });
      expect(app.getByRole("heading", { name: "Multiagent" }).textContent).toBe("Multiagent");
      expect(app.queryByRole("button", { name: "Hide chat" }) === null).toBe(true);
      expect(app.queryByText(/Ctrl\+Q/) === null).toBe(true);
      fireEvent.click(app.getByRole("button", { name: "Agents", exact: true }));
      expect(draft.isConnected).toBe(true);
      expect(draft.closest("section")?.getAttribute("aria-hidden")).toBe("true");
      fireEvent.click(app.getByRole("button", { name: "Chat", exact: true }));
      expect(app.getByRole("textbox", { name: "Draft" }) === draft).toBe(true);
      expect((draft as HTMLInputElement).value).toBe("Keep this draft");
    } finally {
      cleanup();
      globalThis.fetch = previousFetch;
      window.matchMedia = previousMedia;
    }
  });
  test("a single recipient selector switches destinations without showing a roster of buttons", () => {
    function Picker() {
      const [target, setTarget] = useState<ArcadiaMultitaskSendTarget>({ kind: "orchestrator" });
      return <SendTargetPicker compact agents={agents} sendTarget={target} onChange={setTarget} />;
    }
    const app = render(<Picker />);
    const select = app.getByRole("combobox", { name: "Message recipient" }) as HTMLSelectElement;
    expect(select.value).toBe("orchestrator");
    expect(app.queryByRole("button", { name: "Lyra" })).toBeNull();
    fireEvent.change(select, { target: { value: "lyra" } });
    expect(select.value).toBe("lyra");
    fireEvent.change(select, { target: { value: "orchestrator" } });
    expect(select.value).toBe("orchestrator");
  });
  test("the agent tray starts collapsed and retains targeting, model identity, and call controls when opened", () => {
    const target = mock(() => {});
    const speak = mock(() => {});
    const app = render(
      <SubagentSwipeRow
        collapsible
        agents={agents}
        targetedAgentId={null}
        speakPhaseFor={() => "idle"}
        speakDisabled={false}
        onTarget={target}
        onSpeakTo={speak}
        onEndSpeak={() => {}}
      />
    );
    const toggle = app.getByRole("button", { name: /Agents · 1/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(app.queryByRole("list", { name: "Subagents" })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(app.getByRole("list", { name: "Subagents" })).toBeTruthy();
    expect(Boolean(app.getByTitle("anthropic/claude-sonnet-4.6"))).toBe(true);
    fireEvent.click(app.getByRole("button", { name: "Address Lyra" }));
    expect(target).toHaveBeenCalledWith("lyra");
    fireEvent.click(app.getByRole("button", { name: "Speak to Lyra" }));
    expect(speak).toHaveBeenCalledWith("lyra");
    fireEvent.click(toggle);
    expect(app.queryByRole("list", { name: "Subagents" })).toBeNull();
  });
});

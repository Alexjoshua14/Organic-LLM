import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { memo, useState } from "react";
import { SendTargetPicker } from "@/app/sandbox/arcadia/_components/send-target-picker";
import { SubagentSwipeRow } from "@/app/sandbox/arcadia/_components/subagent-swipe-row";
import { MultitaskDashboard } from "@/app/sandbox/arcadia/_components/multitask-dashboard";
import { ArcadiaMultitaskProvider } from "@/app/sandbox/arcadia/_components/multitask-provider";
import { SidebarProvider } from "@/components/third-party/ui/sidebar";
import { FeatureHint } from "@/components/onboarding/feature-hint";
import {
  FeatureHintRegistryProvider,
  useFeatureHintRegistrations,
} from "@/lib/onboarding/feature-hint-context";
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
  test("opening multiagent mode notifies the first-use guide without navigation", () => {
    const GuideProbe = memo(function GuideProbe() {
      const registrations = useFeatureHintRegistrations();
      return (
        <output>{registrations.has("arcadia-multiagent") ? "Guide ready" : "Guide idle"}</output>
      );
    });
    function ModeSwitch() {
      const [enabled, setEnabled] = useState(false);
      return (
        <FeatureHintRegistryProvider>
          <button onClick={() => setEnabled(!enabled)}>Toggle mode</button>
          {enabled && (
            <FeatureHint id="arcadia-multiagent">
              <div>Orchestrator</div>
            </FeatureHint>
          )}
          <GuideProbe />
        </FeatureHintRegistryProvider>
      );
    }
    const app = render(<ModeSwitch />);
    expect(app.getByText("Guide idle")).toBeTruthy();
    fireEvent.click(app.getByRole("button", { name: "Toggle mode" }));
    expect(app.getByText("Guide ready")).toBeTruthy();
    fireEvent.click(app.getByRole("button", { name: "Toggle mode" }));
    expect(app.getByText("Guide idle")).toBeTruthy();
  });
  test.each([true, false])(
    "panel controls keep the draft mounted (condensed: %s)",
    async (condensed) => {
      const previousFetch = globalThis.fetch;
      const previousMedia = window.matchMedia;
      globalThis.fetch = (async () =>
        Response.json({ enabled: true, activeStreamId: null, subagents: agents })) as typeof fetch;
      window.matchMedia = ((query: string) => ({
        matches: condensed && query.includes("max-width"),
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
            <FeatureHintRegistryProvider>
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
            </FeatureHintRegistryProvider>
          );
        });
        const draft = app.getByRole("textbox", { name: "Draft" });
        expect(
          app
            .getByRole("button", { name: "Orchestrator", exact: true })
            .getAttribute("aria-expanded")
        ).toBe("false");
        expect(app.queryByRole("heading", { name: "Multitask dashboard" })).toBeNull();
        expect(app.queryByText(/Ctrl\+Q/) === null).toBe(true);
        if (!condensed) {
          expect(
            app.getByRole("button", { name: "Hide chat" }).getAttribute("aria-keyshortcuts")
          ).toBe("Control+Q");
          expect(
            app.getByRole("button", { name: "Hide board" }).getAttribute("aria-keyshortcuts")
          ).toBe("Control+W");
          const layout = draft.closest("section")!.parentElement!;
          const columns = layout.style.gridTemplateColumns;
          const select = app.getByRole("button", { name: "View agent" });
          fireEvent.pointerDown(select);
          fireEvent.focusIn(select);
          fireEvent.click(select);
          expect(layout.style.gridTemplateColumns).toBe(columns);
          fireEvent.focusIn(draft);
          expect(layout.style.gridTemplateColumns).toBe(columns);
        }
        fireEvent.click(
          app.getByRole("button", { name: condensed ? "Agents" : "Hide chat", exact: true })
        );
        expect(draft.isConnected).toBe(true);
        expect(draft.closest("section")?.getAttribute("aria-hidden")).toBe("true");
        fireEvent.click(
          app.getByRole("button", { name: condensed ? "Chat" : "Show chat", exact: true })
        );
        expect(app.getByRole("textbox", { name: "Draft" }) === draft).toBe(true);
        expect((draft as HTMLInputElement).value).toBe("Keep this draft");
      } finally {
        cleanup();
        globalThis.fetch = previousFetch;
        window.matchMedia = previousMedia;
      }
    }
  );
  test("the target name reveals a stable roster and collapses to the selected recipient", () => {
    function Picker() {
      const [target, setTarget] = useState<ArcadiaMultitaskSendTarget>({ kind: "orchestrator" });
      return <SendTargetPicker agents={agents} sendTarget={target} onChange={setTarget} />;
    }
    const app = render(<Picker />);
    const roster = app.getByRole("group", { name: "Message recipient" });
    const originalSlots = [...roster.querySelectorAll("button")];
    expect(app.queryByRole("button", { name: "Lyra" })).toBeNull();
    fireEvent.click(app.getByRole("button", { name: "Orchestrator" }));
    expect(app.getByRole("button", { name: "Orchestrator" }).getAttribute("aria-expanded")).toBe(
      "true"
    );
    fireEvent.click(app.getByRole("button", { name: "Lyra" }));
    expect(app.queryByRole("button", { name: "Orchestrator" })).toBeNull();
    const lyra = app.getByRole("button", { name: "Lyra" });
    expect(lyra.getAttribute("aria-pressed")).toBe("true");
    expect(lyra.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(lyra);
    expect([...roster.querySelectorAll("button")]).toEqual(originalSlots);
    expect(app.getByRole("button", { name: "Orchestrator" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    fireEvent.click(app.getByRole("button", { name: "Orchestrator" }));
    expect(app.getByRole("button", { name: "Orchestrator" }).getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(app.queryByText("Send to")).toBeNull();
  });
  test("Escape and outside clicks dismiss the roster, leaving only the active button focusable", () => {
    const app = render(
      <SendTargetPicker
        agents={agents}
        sendTarget={{ kind: "subagent", agentId: "lyra" }}
        onChange={() => {}}
      />
    );
    const lyra = app.getByRole("button", { name: "Lyra" });
    fireEvent.click(lyra);
    fireEvent.keyDown(app.getByRole("button", { name: "Orchestrator" }), { key: "Escape" });
    expect(document.activeElement).toBe(lyra);
    expect(lyra.getAttribute("aria-expanded")).toBe("false");
    const hiddenOrchestrator = app.getByRole("group").querySelector("button")!;
    expect(hiddenOrchestrator.tabIndex).toBe(-1);
    fireEvent.click(lyra);
    fireEvent.pointerDown(document.body);
    expect(lyra.getAttribute("aria-expanded")).toBe("false");
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

import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { SendTargetPicker } from "@/app/sandbox/arcadia/_components/send-target-picker";
import { SubagentSwipeRow } from "@/app/sandbox/arcadia/_components/subagent-swipe-row";
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

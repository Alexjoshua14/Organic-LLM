import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import {
  RabbitHoleSubagentMeshBar,
  type RabbitHoleSubagentMeshItem,
} from "@/components/rabbit-holes/RabbitHoleSubagentMeshBar";
import { computeLlmProcessingIntensity } from "@/lib/usage/processing-intensity";
import { render } from "../helpers/render";

afterEach(cleanup);

const MESH_WORKERS: RabbitHoleSubagentMeshItem[] = [
  {
    agentId: "subagent-researcher",
    name: "Lyra",
    role: "researcher",
    status: "working",
    brief: "Investigate primary literature on speculative decoding",
    latestResponse: "Synthesizing 6 peer-reviewed benchmarks from Medusa and Eagle-2.",
  },
  {
    agentId: "agent-coder",
    name: "Reed",
    role: "coder",
    status: "working",
    brief: "Prototype token verification kernel",
    latestResponse: "Implemented tree-attention mask verifier with zero-copy slice.",
  },
  {
    agentId: "subagent-architect",
    name: "Archer",
    role: "architect",
    status: "done",
    brief: "Draft KV-cache invalidation topology",
    latestResponse: "Recommended two-tier ring buffer with asynchronous eviction.",
  },
];

describe("RabbitHoleSubagentMeshBar", () => {
  test("renders active Lyra, Reed, and Archer pills with live intensity attributes on OrganicActivityMark", () => {
    const intensity = computeLlmProcessingIntensity({
      isStreaming: true,
      activeSubagentCount: 2,
      completedSubagentCount: 1,
      toolCallCount: 4,
      estimatedTokensUsed: 8_400,
      planSpentUsd: 3.2,
      planLimitUsd: 10,
      zeroDataRetention: true,
    });

    const view = render(
      <RabbitHoleSubagentMeshBar
        planBudget={{ spentUsd: 3.2, limitUsd: 10, canDispatch: true }}
        processingIntensity={intensity}
        subagents={MESH_WORKERS}
        zeroDataRetention
      />
    );

    // Verify worker pills for Lyra, Reed, and Archer
    expect(view.getByRole("button", { name: /Lyra \(researcher\): Working/i })).toBeTruthy();
    expect(view.getByRole("button", { name: /Reed \(coder\): Working/i })).toBeTruthy();
    expect(view.getByRole("button", { name: /Archer \(architect\): Done/i })).toBeTruthy();

    // Verify OrganicActivityMark has intensity attributes
    const mark = view.getByRole("img", { name: /Organic processing intensity/i });
    expect(mark.getAttribute("data-activity-state")).toBe("working");
    expect(Number(mark.getAttribute("data-intensity"))).toBeCloseTo(intensity.intensity, 3);
    expect(mark.getAttribute("data-intensity-tier")).toBe(intensity.tier);

    // Verify status label, budget utilization gauge, and ZDR badge
    expect(view.container.querySelector("[data-mesh-status-label]")?.textContent).toBe(
      intensity.label
    );
    expect(view.container.querySelector('[data-zdr-badge="true"]')?.textContent).toContain("ZDR");
    const progress = view.getByRole("progressbar", { name: /Weekly plan budget utilization/i });
    expect(progress.getAttribute("aria-valuenow")).toBe("32");
    expect(view.getByText("$3.20 / $10")).toBeTruthy();
  });

  test("clicking a worker pill expands and switches the inline subagent inspector output", () => {
    const view = render(<RabbitHoleSubagentMeshBar subagents={MESH_WORKERS} />);

    // Initially compact until a pill is clicked
    expect(view.container.querySelector("[data-subagent-inspector]")).toBeNull();

    // Click Lyra pill -> expands Lyra's brief and latest response
    fireEvent.click(view.getByRole("button", { name: /Lyra \(researcher\): Working/i }));
    expect(
      view.container.querySelector('[data-subagent-inspector="Lyra"]')
    ).toBeTruthy();
    expect(
      view.getByText("Investigate primary literature on speculative decoding")
    ).toBeTruthy();
    expect(
      view.getByText("Synthesizing 6 peer-reviewed benchmarks from Medusa and Eagle-2.")
    ).toBeTruthy();

    // Click Archer pill -> switches inspector to Archer's output
    fireEvent.click(view.getByRole("button", { name: /Archer \(architect\): Done/i }));
    expect(
      view.container.querySelector('[data-subagent-inspector="Archer"]')
    ).toBeTruthy();
    expect(
      view.getByText("Recommended two-tier ring buffer with asynchronous eviction.")
    ).toBeTruthy();

    // Clicking the active Archer pill again collapses the inspector
    fireEvent.click(view.getByRole("button", { name: /Archer \(architect\): Done/i }));
    expect(view.container.querySelector("[data-subagent-inspector]")).toBeNull();
  });

  test("shifts budget gauge tone when approaching or reaching plan limit", () => {
    const nearLimit = computeLlmProcessingIntensity({
      isStreaming: true,
      planSpentUsd: 8.6,
      planLimitUsd: 10,
    });

    const view = render(
      <RabbitHoleSubagentMeshBar
        planBudget={{ spentUsd: 8.6, limitUsd: 10, canDispatch: true }}
        processingIntensity={nearLimit}
        subagents={[]}
      />
    );

    const gauge = view.container.querySelector("[data-mesh-budget-gauge]");
    expect(gauge?.getAttribute("data-budget-tone")).toBe("warning");
    expect(view.getByText("$8.60 / $10")).toBeTruthy();

    const blockedIntensity = computeLlmProcessingIntensity({
      isStreaming: false,
      planSpentUsd: 10,
      planLimitUsd: 10,
    });

    view.rerender(
      <RabbitHoleSubagentMeshBar
        planBudget={{ spentUsd: 10, limitUsd: 10, canDispatch: false }}
        processingIntensity={blockedIntensity}
        subagents={[]}
      />
    );

    expect(gauge?.getAttribute("data-budget-tone")).toBe("blocked");
    const mark = view.getByRole("img", { name: /Organic processing intensity/i });
    expect(mark.getAttribute("data-activity-state")).toBe("blocked");
  });
});

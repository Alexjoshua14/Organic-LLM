import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import { render } from "../helpers/render";

import { DecisionMatrix } from "@/components/chat/gen-ui/blocks/DecisionMatrix";
import type { DecisionArrangement } from "@/components/chat/gen-ui/blocks/DecisionMatrix";
import { FIXTURE_DECISION_MATRIX } from "@/lib/schemas/gen-ui/fixtures";
import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

const fixture = FIXTURE_DECISION_MATRIX as DecisionMatrixBlock;

afterEach(cleanup);

describe("DecisionMatrix tradeoff map", () => {
  test("criterion lens compares evidence for every option and switches dimensions", () => {
    const view = render(<DecisionMatrix block={fixture} />);
    expect(view.getByText("Managed RDS")).toBeTruthy();
    expect(view.getByText("Embedded")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /Cost at scale/ }));
    expect(view.getByRole("region", { name: "Cost at scale evidence" })).toBeTruthy();
    expect(view.getByText("On-demand spikes")).toBeTruthy();
    expect(view.queryByText("Managed RDS")).toBeNull();
    expect(view.getByLabelText("Postgres score: 3")).toBeTruthy();
    expect(view.getByLabelText("SQLite score: 5")).toBeTruthy();
  });

  test("highlighting an option is reversible and does not hide the other evidence", () => {
    const view = render(<DecisionMatrix block={fixture} />);
    const option = view.getByRole("button", { name: /SQLite/ });
    fireEvent.click(option);
    expect(option.getAttribute("aria-pressed")).toBe("true");
    expect(view.getByLabelText("Postgres score: 4")).toBeTruthy();
    expect(view.container.querySelectorAll('[data-dimmed="true"]').length).toBe(2);
    fireEvent.click(option);
    expect(option.getAttribute("aria-pressed")).toBe("false");
    expect(view.container.querySelectorAll('[data-dimmed="true"]').length).toBe(0);
  });

  test("missing scores break chart paths and remain unknown, including during partial output", () => {
    const block: DecisionMatrixBlock = {
      ...fixture,
      scores: { ...fixture.scores, pg: { ops: { value: 4 }, latency: { value: 4 } } },
    };
    const view = render(<DecisionMatrix block={block} partial />);
    const firstPath = view.container.querySelector("svg path");
    expect(firstPath?.getAttribute("d")?.match(/M/g)?.length).toBe(2);
    expect(firstPath?.getAttribute("d")).not.toContain("L");
    fireEvent.click(view.getByRole("button", { name: /Cost at scale/ }));
    expect(view.getByLabelText("Postgres score: unknown")).toBeTruthy();
    expect(view.getByText("Awaiting score…")).toBeTruthy();
    expect(view.getByText(/Gaps are unknown/)).toBeTruthy();
    expect(view.queryByText(/Weighted total/)).toBeNull();
  });

  test("symbols remain literal with disclosed map conversion; recommendation does not become a score winner", () => {
    const block: DecisionMatrixBlock = {
      ...fixture,
      scores: { ...fixture.scores, pg: { ...fixture.scores.pg, ops: { value: "~" } } },
    };
    const view = render(<DecisionMatrix block={block} />);
    expect(view.getByLabelText("Postgres score: ~")).toBeTruthy();
    expect(view.getByText(/Map positions: ✓ = 5, ~ = 3, ✗ = 1/)).toBeTruthy();
    expect(view.getByText("Aion’s recommendation · Postgres")).toBeTruthy();
    expect(view.getByText("Scores, 1–5 · not a ranking")).toBeTruthy();
    expect(view.queryByText(/winner|best score/i)).toBeNull();
  });

  test("default arrangement is overview and matches explicit overview", () => {
    const implicit = render(<DecisionMatrix block={fixture} />);
    expect(implicit.container.querySelector('[data-arrangement="overview"]')).toBeTruthy();
    expect(implicit.container.querySelector("svg.plot, svg")).toBeTruthy();
    cleanup();

    const explicit = render(<DecisionMatrix block={fixture} arrangement="overview" />);
    expect(explicit.container.querySelector('[data-arrangement="overview"]')).toBeTruthy();
    expect(explicit.getByText("Scores, 1–5 · not a ranking")).toBeTruthy();
  });
});

describe("DecisionMatrix arrangements", () => {
  test("recommendation leads without a mandatory score chart", () => {
    const view = render(<DecisionMatrix block={fixture} arrangement="recommendation" />);
    expect(view.container.querySelector('[data-arrangement="recommendation"]')).toBeTruthy();
    expect(view.getByText("Aion’s recommendation · Postgres")).toBeTruthy();
    expect(view.getByText(/model pick/)).toBeTruthy();
    expect(view.container.querySelector("svg")).toBeNull();
    expect(view.getByText(/no shape chart/i)).toBeTruthy();
    expect(view.getAllByText("Team familiarity").length).toBeGreaterThan(0);
    fireEvent.click(view.getByRole("button", { name: /Cost at scale/ }));
    expect(view.getByRole("region", { name: "Cost at scale evidence" })).toBeTruthy();
    expect(view.getByText("On-demand spikes")).toBeTruthy();
    expect(view.queryByText(/winner|Weighted total/i)).toBeNull();
  });

  test("evidence arrangement prioritizes notes and keeps the plot optional", () => {
    const view = render(<DecisionMatrix block={fixture} arrangement="evidence" />);
    expect(view.container.querySelector('[data-arrangement="evidence"]')).toBeTruthy();
    expect(view.getByRole("region", { name: "Operational burden evidence" })).toBeTruthy();
    expect(view.getByText("Managed RDS")).toBeTruthy();
    const plotDisclosure = view.getByText("Score map (optional)").closest("details");
    expect(plotDisclosure).toBeTruthy();
    expect(plotDisclosure?.hasAttribute("open")).toBe(false);
    expect(plotDisclosure?.querySelector("svg")).toBeTruthy();
    fireEvent.click(view.getByText("Score map (optional)"));
    expect(plotDisclosure?.hasAttribute("open")).toBe(true);
    expect(view.getByText("Scores, 1–5 · not a ranking")).toBeTruthy();
    expect(view.queryByText(/winner|best score/i)).toBeNull();
  });

  test("head-to-head compares two selectable options across every criterion", () => {
    const view = render(<DecisionMatrix block={fixture} arrangement="head-to-head" />);
    expect(view.container.querySelector('[data-arrangement="head-to-head"]')).toBeTruthy();
    expect(view.getByLabelText("Option A")).toBeTruthy();
    expect(view.getByLabelText("Option B")).toBeTruthy();
    expect(view.getByText("Operational burden")).toBeTruthy();
    expect(view.getByText("Cost at scale")).toBeTruthy();
    expect(view.getByText("p99 latency")).toBeTruthy();
    expect(view.getByText(/Head-to-head shows two options/)).toBeTruthy();
    expect(view.getByText("Notes for options not in this pair")).toBeTruthy();
    expect(view.container.querySelector("svg")).toBeNull();

    fireEvent.change(view.getByLabelText("Option A"), { target: { value: "sqlite" } });
    fireEvent.change(view.getByLabelText("Option B"), { target: { value: "dynamo" } });
    expect(view.getByLabelText("SQLite, Operational burden: 5")).toBeTruthy();
    expect(view.getByLabelText("DynamoDB, Operational burden: 2")).toBeTruthy();
    expect(view.queryByText(/winner|Weighted total/i)).toBeNull();
  });

  test("compact arrangement is a dense score grid without a giant plot", () => {
    const view = render(<DecisionMatrix block={fixture} arrangement="compact" />);
    expect(view.container.querySelector('[data-arrangement="compact"]')).toBeTruthy();
    expect(view.container.querySelector("svg")).toBeNull();
    expect(view.getByRole("table")).toBeTruthy();
    expect(view.getByLabelText("Postgres, Operational burden: 4")).toBeTruthy();
    expect(view.getByLabelText("DynamoDB, p99 latency: 5")).toBeTruthy();
    expect(view.getByText("Option and criterion notes")).toBeTruthy();
    expect(view.getByText(/not a ranking/i)).toBeTruthy();
    expect(view.queryByText(/winner|Weighted total/i)).toBeNull();
  });

  test("each arrangement surfaces supplied notes and keeps recommendation copy", () => {
    const arrangements: DecisionArrangement[] = [
      "overview",
      "recommendation",
      "evidence",
      "head-to-head",
      "compact",
    ];

    for (const arrangement of arrangements) {
      const view = render(<DecisionMatrix block={fixture} arrangement={arrangement} />);
      expect(view.getByText("Aion’s recommendation · Postgres")).toBeTruthy();

      if (arrangement === "compact") {
        fireEvent.click(view.getByText("Option and criterion notes"));
        expect(view.getByText("Managed RDS")).toBeTruthy();
        expect(view.getByText("On-demand spikes")).toBeTruthy();
      } else if (arrangement === "recommendation") {
        expect(view.getAllByText("Team familiarity").length).toBeGreaterThan(0);
        expect(view.getByText("Managed RDS")).toBeTruthy();
        fireEvent.click(view.getByRole("button", { name: /Cost at scale/ }));
        expect(view.getByText("On-demand spikes")).toBeTruthy();
      } else if (arrangement === "head-to-head") {
        expect(view.getByText("Managed RDS")).toBeTruthy();
        fireEvent.click(view.getByText("Notes for options not in this pair"));
        expect(view.getByText("On-demand spikes")).toBeTruthy();
      } else {
        expect(view.getByText("Managed RDS")).toBeTruthy();
        fireEvent.click(view.getByRole("button", { name: /Cost at scale/ }));
        expect(view.getByText("On-demand spikes")).toBeTruthy();
      }

      expect(view.queryByText(/winner|best score|Weighted total/i)).toBeNull();
      cleanup();
    }
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, within } from "@testing-library/react";

import { render } from "../helpers/render";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { PlanTimeline } from "@/components/chat/gen-ui/blocks/PlanTimeline";
import {
  derivePlan,
  describeTally,
  pickLeadIndex,
} from "@/components/chat/gen-ui/plan/plan-model";
import { FIXTURE_PLAN_TIMELINE } from "@/lib/schemas/gen-ui/fixtures";
import type { PlanTimelineBlock, PlanTimelineStep } from "@/lib/schemas/gen-ui";

afterEach(cleanup);

const fixture = FIXTURE_PLAN_TIMELINE as PlanTimelineBlock;

function plan(steps: PlanTimelineStep[], title = "Test plan"): PlanTimelineBlock {
  return { type: "plan-timeline", version: 1, title, steps };
}

function step(id: string, status: PlanTimelineStep["status"], extra: Partial<PlanTimelineStep> = {}) {
  return { id, label: `Label ${id}`, status, ...extra } satisfies PlanTimelineStep;
}

function indexOf(view: ReturnType<typeof render>) {
  return view.getByRole("list", { name: "All steps" });
}

describe("plan model", () => {
  test("lead is the first now, else first blocked, else first next, else the last step", () => {
    expect(pickLeadIndex([step("a", "done"), step("b", "now"), step("c", "now")])).toBe(1);
    expect(pickLeadIndex([step("a", "next"), step("b", "blocked"), step("c", "next")])).toBe(1);
    expect(pickLeadIndex([step("a", "done"), step("b", "next")])).toBe(1);
    expect(pickLeadIndex([step("a", "done"), step("b", "done")])).toBe(1);
  });

  test("dependencies resolve to steps, and dangling, self and shared ids are classified", () => {
    const model = derivePlan(
      plan([
        step("a", "done"),
        step("b", "now", { dependsOn: ["a", "a", "ghost", "b"] }),
        step("dup", "next"),
        step("dup", "next", { dependsOn: ["dup", "a"] }),
        step("c", "next", { dependsOn: ["dup"] }),
      ])
    );

    expect(model.steps[1]?.dependsOn).toEqual([
      { kind: "step", id: "a", index: 0, matches: 1 },
      { kind: "missing", id: "ghost" },
      { kind: "self", id: "b" },
    ]);
    // A shared id resolves to the first *other* match; a step never depends on itself by accident.
    expect(model.steps[3]?.dependsOn[0]).toEqual({ kind: "step", id: "dup", index: 2, matches: 2 });
    expect(model.steps[4]?.dependsOn[0]).toEqual({ kind: "step", id: "dup", index: 2, matches: 2 });
    expect(model.steps[0]?.neededBy).toEqual([1, 3]);
    expect(new Set(model.steps.map((view) => view.key)).size).toBe(5);
  });

  test("tally is a labelled count of steps, never a percentage", () => {
    const text = describeTally(
      derivePlan(plan([step("a", "done"), step("b", "now"), step("c", "blocked"), step("d", "next")]))
        .tally
    );

    expect(text).toBe("1 of 4 steps done · 1 now · 1 blocked · 1 next");
    expect(text).not.toMatch(/%/);
    expect(describeTally(derivePlan(plan([step("a", "done"), step("b", "done")])).tally)).toBe(
      "All 2 steps done"
    );
    expect(describeTally(derivePlan(plan([step("a", "next")])).tally)).toBe(
      "0 of 1 step done · none marked now · 1 next"
    );
  });

  test("timed is true only when a step or sub-step supplies a time", () => {
    expect(derivePlan(plan([step("a", "now")])).timed).toBe(false);
    expect(derivePlan(plan([step("a", "now", { substeps: [{ label: "x", time: "6 PM" }] })])).timed).toBe(
      true
    );
  });
});

describe("PlanTimeline full", () => {
  test("states the plan in words: counted summary, status words, current step in focus", () => {
    const view = render(<PlanTimeline block={fixture} />);

    expect(view.getByRole("heading", { level: 3, name: "Arcadia gen-UI rollout" })).toBeTruthy();
    expect(view.getByText("1 of 4 steps done · 1 now · 1 blocked · 1 next")).toBeTruthy();
    expect(view.getByRole("heading", { level: 4, name: "Sandbox gallery" })).toBeTruthy();
    const rows = within(indexOf(view)).getAllByRole("listitem");

    expect(rows).toHaveLength(4);
    const words = rows.map((row) => within(row).getByText(/^(Done|Now|Next|Blocked)$/).textContent);

    expect(words).toEqual(["Done", "Now", "Next", "Blocked"]);
    // The step that is now is flagged for assistive tech, and is the one selected.
    const nowButton = within(rows[1]!).getByRole("button");

    expect(nowButton.getAttribute("aria-current")).toBe("step");
    expect(nowButton.getAttribute("aria-pressed")).toBe("true");
  });

  test("exact time and estimate are labelled and verbatim; sub-steps show a count and their times", () => {
    const block = plan([
      step("prep", "now", {
        label: "Thursday prep",
        time: "~6:00 PM",
        estimate: "20 min",
        substeps: [
          { label: "Chop onions", done: true, time: "~6:05 PM" },
          { label: "Marinate lamb", time: "~6:30 PM" },
          { label: "Soak chickpeas" },
        ],
      }),
      step("serve", "next", { time: "Friday", label: "Serve" }),
    ]);
    const view = render(<PlanTimeline block={block} />);

    expect(view.getByText("Time").nextElementSibling?.textContent).toBe("~6:00 PM");
    expect(view.getByText("Estimate").nextElementSibling?.textContent).toBe("20 min");
    expect(view.getByText("Sub-steps · 1 of 3 marked done")).toBeTruthy();
    expect(view.getByText("~6:05 PM")).toBeTruthy();
    expect(view.getByText("~6:30 PM")).toBeTruthy();
    expect(view.getByText("Done:")).toBeTruthy();
    expect(view.getAllByText(/Not marked done:/)).toHaveLength(2);
    // The index keeps the time on its rail and labels the estimate as an estimate.
    const row = within(indexOf(view)).getAllByRole("listitem")[0]!;

    expect(within(row).getByText("~6:00 PM")).toBeTruthy();
    expect(within(row).getByText("Estimate 20 min")).toBeTruthy();
    expect(within(row).getByText("1 of 3 sub-steps done")).toBeTruthy();
    expect(within(indexOf(view)).getByText("Friday")).toBeTruthy();
  });

  test("nothing implies percent complete or a live completion control", () => {
    const view = render(<PlanTimeline block={fixture} />);

    expect(view.container.textContent).not.toMatch(/%/);
    expect(view.queryByRole("progressbar")).toBeNull();
    expect(view.queryByRole("checkbox")).toBeNull();
    expect(view.container.querySelector("input")).toBeNull();
    // Every control is a native, natively-focusable button.
    const controls = view.container.querySelectorAll("button, a, [tabindex]");

    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((el) => {
      expect(el.tagName).toBe("BUTTON");
      expect(el.hasAttribute("tabindex")).toBe(false);
    });
  });

  test("a blocked step's reason is visible in the index without selecting it, and in focus when selected", () => {
    const view = render(<PlanTimeline block={fixture} />);

    expect(within(indexOf(view)).getByText("Awaiting TTS UX sign-off")).toBeTruthy();
    expect(view.queryByText("Why it is blocked")).toBeNull();

    fireEvent.click(within(indexOf(view)).getByRole("button", { name: /Audio Phase 2/ }));
    expect(view.getByRole("heading", { level: 4, name: "Audio Phase 2" })).toBeTruthy();
    expect(view.getByText("Why it is blocked")).toBeTruthy();
    expect(view.getAllByText("Awaiting TTS UX sign-off")).toHaveLength(2);
    expect(view.getByRole("status").textContent).toContain("Showing step 4 of 4: Audio Phase 2");
  });

  test("a blocked step with no note says no reason was given", () => {
    const view = render(<PlanTimeline block={plan([step("a", "blocked")])} />);

    expect(within(indexOf(view)).getByText("No reason given.")).toBeTruthy();
    expect(view.getByText("No reason was given.")).toBeTruthy();
  });

  test("selecting rows and prev / next move the focus; selection is only view state", () => {
    const view = render(<PlanTimeline block={fixture} />);
    const next = () => view.getByRole("button", { name: /^Next step/ });
    const previous = () => view.getByRole("button", { name: /^Previous step/ });

    fireEvent.click(next());
    expect(view.getByRole("heading", { level: 4, name: "Arcadia tool wiring" })).toBeTruthy();
    fireEvent.click(previous());
    fireEvent.click(previous());
    expect(view.getByRole("heading", { level: 4, name: "Schema + registry" })).toBeTruthy();
    expect((previous() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(indexOf(view)).getByRole("button", { name: /Audio Phase 2/ }));
    expect((next() as HTMLButtonElement).disabled).toBe(true);
  });

  test("dependencies are readable with their status and jump to the step", () => {
    const view = render(<PlanTimeline block={fixture} />);

    fireEvent.click(within(indexOf(view)).getByRole("button", { name: /Arcadia tool wiring/ }));
    const depends = view.getByRole("list", { name: "Depends on" });
    const link = within(depends).getByRole("button", { name: /Sandbox gallery/ });

    expect(link.textContent).toContain("Now");
    expect(within(indexOf(view)).getByText("Needs 02")).toBeTruthy();
    fireEvent.click(link);
    expect(view.getByRole("heading", { level: 4, name: "Sandbox gallery" })).toBeTruthy();
    expect(within(view.getByRole("list", { name: "Needed by" })).getByRole("button")).toBeTruthy();
  });

  test("dangling and self dependencies render as plain text, never as dead links", () => {
    const view = render(
      <PlanTimeline block={plan([step("a", "now", { dependsOn: ["nope", "a"] })])} />
    );
    const depends = view.getByRole("list", { name: "Depends on" });

    expect(within(depends).queryByRole("button")).toBeNull();
    expect(within(depends).getByText("nope")).toBeTruthy();
    expect(within(depends).getByText("is not a step in this plan")).toBeTruthy();
    expect(within(depends).getByText("depends on itself")).toBeTruthy();
    expect(within(indexOf(view)).getByText("Needs 1 unknown · itself")).toBeTruthy();
  });

  test("duplicate ids do not collide and a shared id is disclosed", () => {
    const view = render(
      <PlanTimeline
        block={plan([
          step("x", "done"),
          step("x", "now"),
          step("y", "next", { dependsOn: ["x"] }),
        ])}
      />
    );

    expect(within(indexOf(view)).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(within(indexOf(view)).getByRole("button", { name: /Label y/ }));
    expect(view.getByText(/id shared by 2 steps/)).toBeTruthy();
  });

  test("several now steps are all recognised, and each can be reached from the focus", () => {
    const view = render(
      <PlanTimeline block={plan([step("a", "now"), step("b", "done"), step("c", "now")])} />
    );

    expect(view.getByText("1 of 3 steps done · 2 now")).toBeTruthy();
    const current = within(indexOf(view))
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-current") === "step");

    expect(current).toHaveLength(2);
    const also = view.getByRole("list", { name: "Also now" });

    fireEvent.click(within(also).getByRole("button", { name: /Label c/ }));
    expect(view.getByRole("heading", { level: 4, name: "Label c" })).toBeTruthy();
  });

  test("with no current step the focus lands on what needs attention", () => {
    const withBlocked = render(
      <PlanTimeline block={plan([step("a", "done"), step("b", "next"), step("c", "blocked")])} />
    );

    expect(withBlocked.getByText(/none marked now/)).toBeTruthy();
    expect(withBlocked.getByRole("heading", { level: 4, name: "Label c" })).toBeTruthy();
    cleanup();

    const allNext = render(<PlanTimeline block={plan([step("a", "next"), step("b", "next")])} />);

    expect(allNext.getByRole("heading", { level: 4, name: "Label a" })).toBeTruthy();
    cleanup();

    const allDone = render(<PlanTimeline block={plan([step("a", "done"), step("b", "done")])} />);

    expect(allDone.getByText("All 2 steps done")).toBeTruthy();
    expect(allDone.getByRole("heading", { level: 4, name: "Label b" })).toBeTruthy();
  });

  test("until the reader chooses, focus follows the data; a choice sticks", () => {
    const first = plan([step("a", "now"), step("b", "next"), step("c", "next")]);
    const advanced = plan([step("a", "done"), step("b", "now"), step("c", "next")]);
    const view = render(<PlanTimeline block={first} />);

    expect(view.getByRole("heading", { level: 4, name: "Label a" })).toBeTruthy();
    view.rerender(<PlanTimeline block={advanced} />);
    expect(view.getByRole("heading", { level: 4, name: "Label b" })).toBeTruthy();
    fireEvent.click(within(indexOf(view)).getByRole("button", { name: /Label c/ }));
    view.rerender(<PlanTimeline block={first} />);
    expect(view.getByRole("heading", { level: 4, name: "Label c" })).toBeTruthy();
    // A stale choice (the plan got shorter) falls back instead of rendering nothing.
    view.rerender(<PlanTimeline block={plan([step("a", "now")])} />);
    expect(view.getByRole("heading", { level: 4, name: "Label a" })).toBeTruthy();
  });

  test("a single step and a twenty-step plan both render every step", () => {
    const one = render(<PlanTimeline block={plan([step("only", "now")])} />);

    expect(one.getByText("0 of 1 step done · 1 now")).toBeTruthy();
    expect((one.getByRole("button", { name: /^Next step/ }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    const many = plan(
      Array.from({ length: 20 }, (_, i) =>
        step(`s${i}`, i < 7 ? "done" : i === 7 ? "now" : i === 12 ? "blocked" : "next", {
          note: `Note ${i}`,
          dependsOn: i > 0 ? [`s${i - 1}`] : undefined,
        })
      )
    );
    const view = render(<PlanTimeline block={many} />);

    expect(within(indexOf(view)).getAllByRole("listitem")).toHaveLength(20);
    expect(view.getByText("7 of 20 steps done · 1 now · 1 blocked · 11 next")).toBeTruthy();
    expect(view.container.querySelectorAll("[data-status]").length).toBeGreaterThan(40);
  });

  test("plans rendered by the gen-UI registry use the new frame", () => {
    const view = render(<GenUIRenderer data={{ block: fixture }} messageId="plan" />);

    expect(view.getByText("1 of 4 steps done · 1 now · 1 blocked · 1 next")).toBeTruthy();
  });
});

describe("PlanTimeline morph contract", () => {
  test("full + morphIds carries plan-title, plan-progress and a step id per step", () => {
    const view = render(<PlanTimeline block={fixture} morphIds />);
    const ids = [...view.container.querySelectorAll("[data-morph-id]")].map((el) =>
      el.getAttribute("data-morph-id")
    );

    expect(ids.sort()).toEqual(
      ["plan-progress", "plan-title", "step-s1", "step-s2", "step-s3", "step-s4"].sort()
    );
  });

  test("full without morphIds carries none", () => {
    const view = render(<PlanTimeline block={fixture} />);

    expect(view.container.querySelectorAll("[data-morph-id]")).toHaveLength(0);
  });

  test("condensed always carries plan-title, plan-progress and the lead step, with no controls", () => {
    const view = render(<PlanTimeline block={fixture} variant="condensed" />);
    const ids = [...view.container.querySelectorAll("[data-morph-id]")].map((el) =>
      el.getAttribute("data-morph-id")
    );

    expect(ids.sort()).toEqual(["plan-progress", "plan-title", "step-s2"]);
    expect(view.container.querySelectorAll("button")).toHaveLength(0);
    expect(view.container.querySelector('[data-morph-id="step-s2"]')?.textContent).toBe(
      "Now: Sandbox gallery"
    );
    expect(view.getByText("1 of 4 steps done · 1 now · 1 blocked · 1 next")).toBeTruthy();
  });

  test("condensed names what needs attention when nothing is now", () => {
    const view = render(
      <PlanTimeline
        block={plan([step("a", "done"), step("b", "blocked", { label: "Waiting on legal" })])}
        variant="condensed"
      />
    );

    expect(view.container.querySelector('[data-morph-id="step-b"]')?.textContent).toBe(
      "Blocked: Waiting on legal"
    );
  });
});

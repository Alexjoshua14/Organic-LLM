import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, within } from "@testing-library/react";

import { render } from "../helpers/render";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { PlanTimeline } from "@/components/chat/gen-ui/blocks/PlanTimeline";
import {
  derivePlan,
  describeTally,
  pickLeadIndex,
  pickOpenIndex,
  stepHasDetail,
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

/** The plan's own rows, not the sub-step / relationship items inside an open step. */
function rowsOf(view: ReturnType<typeof render>) {
  return [...indexOf(view).children] as HTMLElement[];
}

/** A row's own button (not a relationship link to that step inside an open detail). */
function rowButton(view: ReturnType<typeof render>, name: RegExp) {
  const matches = rowsOf(view)
    .map((row) => row.firstElementChild)
    .filter(
      (head): head is HTMLButtonElement =>
        head?.tagName === "BUTTON" && name.test(head.textContent ?? "")
    );

  expect(matches).toHaveLength(1);

  return matches[0]!;
}

/** The open step's detail region (at most one), or null. */
function openRegion(view: ReturnType<typeof render>) {
  return within(view.container).queryByRole("region");
}

describe("plan model", () => {
  test("lead is the first now, else first blocked, else first next, else the last step", () => {
    expect(pickLeadIndex([step("a", "done"), step("b", "now"), step("c", "now")])).toBe(1);
    expect(pickLeadIndex([step("a", "next"), step("b", "blocked"), step("c", "next")])).toBe(1);
    expect(pickLeadIndex([step("a", "done"), step("b", "next")])).toBe(1);
    expect(pickLeadIndex([step("a", "done"), step("b", "done")])).toBe(1);
  });

  test("nothing opens by default when every step is done", () => {
    expect(pickOpenIndex(derivePlan(plan([step("a", "done"), step("b", "now")])))).toBe(1);
    expect(pickOpenIndex(derivePlan(plan([step("a", "done"), step("b", "done")])))).toBe(-1);
  });

  test("a step has detail only when opening it would reveal something", () => {
    const model = derivePlan(
      plan([
        step("bare", "next"),
        step("timed", "next", { time: "6 PM" }),
        step("both", "next", { time: "6 PM", estimate: "1h" }),
        step("blocked", "blocked"),
        step("dep", "next", { dependsOn: ["bare"] }),
      ])
    );

    expect(model.steps.map(stepHasDetail)).toEqual([true, false, true, true, true]);
    expect(stepHasDetail(derivePlan(plan([step("solo", "now")])).steps[0]!)).toBe(false);
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
  test("one ordered list: counted summary, a status word per row, the current step open in place", () => {
    const view = render(<PlanTimeline block={fixture} />);

    expect(view.getByRole("heading", { level: 3, name: "Arcadia gen-UI rollout" })).toBeTruthy();
    expect(view.getByText("1 of 4 steps done · 1 now · 1 blocked · 1 next")).toBeTruthy();
    const rows = rowsOf(view);

    expect(rows).toHaveLength(4);
    // Every row carries its status as a word (visible for Now / Blocked, for AT on Done / Next).
    const words = rows.map(
      (row) => within(row.firstElementChild as HTMLElement).getByText(/^(Done|Now|Next|Blocked)$/).textContent
    );

    expect(words).toEqual(["Done", "Now", "Next", "Blocked"]);
    const nowButton = rowButton(view, /Sandbox gallery/);

    expect(nowButton.getAttribute("aria-current")).toBe("step");
    expect(nowButton.getAttribute("aria-expanded")).toBe("true");
    expect(openRegion(view)?.getAttribute("aria-labelledby")).toBe(nowButton.id);
    expect(view.queryAllByRole("region")).toHaveLength(1);
  });

  test("a step with nothing more to show is a plain row, not a control", () => {
    const view = render(<PlanTimeline block={fixture} />);
    const first = rowsOf(view)[0]!;

    expect(within(first).queryByRole("button")).toBeNull();
    expect(first.textContent).toContain("Schema + registry");
  });

  test("time sits on the rail verbatim; the estimate is labelled; sub-steps show a count and times", () => {
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
      step("study", "next", { estimate: "2h", label: "Study" }),
    ]);
    const view = render(<PlanTimeline block={block} />);
    const [prep, serve, study] = rowsOf(view);

    // Open step: time on the rail (not repeated), estimate as a labelled fact.
    expect(within(prep!).getByText("~6:00 PM")).toBeTruthy();
    expect([...openRegion(view)!.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual([
      "Estimate",
    ]);
    expect(
      within(openRegion(view)!).getByText("Estimate").nextElementSibling?.textContent
    ).toBe("20 min");
    expect(view.getByText("Sub-steps · 1 of 3 marked done")).toBeTruthy();
    expect(view.getByText("~6:05 PM")).toBeTruthy();
    expect(view.getByText("~6:30 PM")).toBeTruthy();
    expect(view.getByText("Done:")).toBeTruthy();
    expect(view.getAllByText(/Not marked done:/)).toHaveLength(2);
    expect(within(serve!).getByText("Friday")).toBeTruthy();
    // With no time, the estimate takes the rail, still labelled as an estimate.
    expect(within(study!).getByText("2h").textContent).toBe("Est. Estimate 2h");

    // Collapsed, the row keeps the facts the detail held as a one-line summary.
    fireEvent.click(rowButton(view, /Thursday prep/));
    expect(openRegion(view)).toBeNull();
    expect(within(prep!).getByText("Estimate 20 min")).toBeTruthy();
    expect(within(prep!).getByText("1 of 3 sub-steps done")).toBeTruthy();
    expect(within(prep!).getByText("~6:00 PM")).toBeTruthy();
  });

  test("nothing implies percent complete or a live completion control", () => {
    const view = render(<PlanTimeline block={fixture} />);

    expect(view.container.textContent).not.toMatch(/%/);
    // Scoped to the card: `view.queryBy*` searches the whole document, and in a full run another
    // file's leftover DOM (a checkbox) made this fail in CI although the Plan renders no input.
    const card = within(view.container);

    expect(card.queryByRole("progressbar")).toBeNull();
    expect(card.queryByRole("checkbox")).toBeNull();
    expect(view.container.querySelector("input")).toBeNull();
    // Every control is a native, natively-focusable button.
    const controls = view.container.querySelectorAll("button, a, [tabindex]");

    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((el) => {
      expect(el.tagName).toBe("BUTTON");
      expect(el.hasAttribute("tabindex")).toBe(false);
    });
  });

  test("a blocked step's reason is always visible — under its row, or in its detail when open", () => {
    const view = render(<PlanTimeline block={fixture} />);

    expect(within(indexOf(view)).getAllByText("Awaiting TTS UX sign-off")).toHaveLength(1);
    expect(view.queryByText("Why blocked")).toBeNull();

    fireEvent.click(rowButton(view, /Audio Phase 2/));
    expect(within(openRegion(view)!).getByText("Why blocked")).toBeTruthy();
    expect(within(openRegion(view)!).getByText("Awaiting TTS UX sign-off")).toBeTruthy();
    expect(view.getAllByText("Awaiting TTS UX sign-off")).toHaveLength(1);
  });

  test("a blocked step with no note says no reason was given", () => {
    const view = render(<PlanTimeline block={plan([step("a", "blocked")])} />);

    expect(view.getByText("Why blocked")).toBeTruthy();
    expect(view.getByText("No reason given.")).toBeTruthy();
    fireEvent.click(rowButton(view, /Label a/));
    expect(view.getByText("No reason given.")).toBeTruthy();
  });

  test("one step open at a time; the open row closes on a second press; only view state changes", () => {
    const view = render(<PlanTimeline block={fixture} />);
    const gallery = rowButton(view, /Sandbox gallery/);
    const wiring = rowButton(view, /Arcadia tool wiring/);

    fireEvent.click(wiring);
    expect(wiring.getAttribute("aria-expanded")).toBe("true");
    expect(gallery.getAttribute("aria-expanded")).toBe("false");
    expect(view.queryAllByRole("region")).toHaveLength(1);
    fireEvent.click(wiring);
    expect(openRegion(view)).toBeNull();
    // Closing everything is a choice that sticks; the data is untouched.
    expect(view.getByText("1 of 4 steps done · 1 now · 1 blocked · 1 next")).toBeTruthy();
  });

  test("dependencies are readable with their status and jump to the step, focus following", () => {
    const view = render(<PlanTimeline block={fixture} />);

    expect(within(indexOf(view)).getByText("Needs 02")).toBeTruthy();
    fireEvent.click(rowButton(view, /Arcadia tool wiring/));
    const depends = view.getByRole("list", { name: "Depends on" });
    const link = within(depends).getByRole("button", { name: /Sandbox gallery/ });

    expect(link.textContent).toContain("Now");
    fireEvent.click(link);
    const gallery = rowButton(view, /Sandbox gallery/);

    expect(gallery.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(gallery);
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
    fireEvent.click(rowButton(view, /Label a/));
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

    expect(rowsOf(view)).toHaveLength(3);
    fireEvent.click(rowButton(view, /Label y/));
    expect(view.getByText(/id shared by 2 steps/)).toBeTruthy();
  });

  test("several now steps are all marked current and each says Now", () => {
    const view = render(
      <PlanTimeline block={plan([step("a", "now"), step("b", "done"), step("c", "now")])} />
    );

    expect(view.getByText("1 of 3 steps done · 2 now")).toBeTruthy();
    expect(indexOf(view).querySelectorAll('[aria-current="step"]')).toHaveLength(2);
    expect(within(indexOf(view)).getAllByText("Now")).toHaveLength(2);
  });

  test("with no current step the open step is what needs attention", () => {
    const withBlocked = render(
      <PlanTimeline block={plan([step("a", "done"), step("b", "next"), step("c", "blocked")])} />
    );

    expect(withBlocked.getByText(/none marked now/)).toBeTruthy();
    expect(rowButton(withBlocked, /Label c/).getAttribute("aria-expanded")).toBe("true");
    cleanup();

    const allNext = render(
      <PlanTimeline
        block={plan([step("a", "next", { note: "First" }), step("b", "next", { note: "Then" })])}
      />
    );

    expect(rowButton(allNext, /Label a/).getAttribute("aria-expanded")).toBe("true");
    cleanup();

    const allDone = render(
      <PlanTimeline
        block={plan([step("a", "done", { note: "x" }), step("b", "done", { note: "y" })])}
      />
    );

    expect(allDone.getByText("All 2 steps done")).toBeTruthy();
    expect(openRegion(allDone)).toBeNull();
  });

  test("until the reader chooses, the open step follows the data; a choice sticks", () => {
    const withNotes = (statuses: PlanTimelineStep["status"][]) =>
      plan(statuses.map((status, i) => step("abc"[i]!, status, { note: `Note ${i}` })));
    const open = (view: ReturnType<typeof render>) =>
      openRegion(view)?.getAttribute("aria-labelledby");
    const view = render(<PlanTimeline block={withNotes(["now", "next", "next"])} />);

    expect(open(view)).toBe(rowButton(view, /Label a/).id);
    view.rerender(<PlanTimeline block={withNotes(["done", "now", "next"])} />);
    expect(open(view)).toBe(rowButton(view, /Label b/).id);
    fireEvent.click(rowButton(view, /Label c/));
    view.rerender(<PlanTimeline block={withNotes(["now", "next", "next"])} />);
    expect(open(view)).toBe(rowButton(view, /Label c/).id);
    // A stale choice (the plan got shorter) falls back instead of rendering nothing.
    view.rerender(<PlanTimeline block={withNotes(["now"])} />);
    expect(open(view)).toBe(rowButton(view, /Label a/).id);
  });

  test("a single step and a twenty-step plan both render every step, with one open", () => {
    const one = render(<PlanTimeline block={plan([step("only", "now")])} />);

    expect(one.getByText("0 of 1 step done · 1 now")).toBeTruthy();
    expect(rowsOf(one)).toHaveLength(1);
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

    expect(rowsOf(view)).toHaveLength(20);
    expect(view.getByText("7 of 20 steps done · 1 now · 1 blocked · 11 next")).toBeTruthy();
    expect(view.queryAllByRole("region")).toHaveLength(1);
    expect(rowButton(view, /Label s7/).getAttribute("aria-expanded")).toBe("true");
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

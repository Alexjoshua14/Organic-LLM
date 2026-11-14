import { afterEach, expect, jest, test } from "bun:test";
import { act, cleanup, fireEvent, within } from "@testing-library/react";

import { SubagentCardLab } from "@/app/sandbox/subagents/cards/_components/subagent-card-lab";
import { models } from "@/lib/schemas/chat";

import { render } from "../helpers/render";

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test("lab controls keep both versions and device previews in the same agent state", () => {
  const app = render(<SubagentCardLab />);

  fireEvent.click(app.getByRole("radio", { name: "Blocked" }));

  for (const version of ["Current", "Next"]) {
    for (const device of ["desktop", "mobile"]) {
      // Mobile samples are `hidden sm:block` so phones keep a single readable card in 100vh.
      const sample = app.getByRole("region", {
        name: `${version} ${device} card`,
        hidden: device === "mobile",
      });

      expect(sample.querySelector('[data-activity-state="blocked"]')).not.toBeNull();
      expect(within(sample).getByText("Lyra")).toBeTruthy();
      expect(within(sample).getByText(models.anthropic.sonnet.name)).toBeTruthy();
    }
  }

  fireEvent.click(app.getByRole("switch", { name: "Call active" }));

  for (const version of ["Current", "Next"]) {
    const desktop = within(app.getByRole("region", { name: `${version} desktop card` }));

    expect(desktop.getByRole("button", { name: "End voice session" })).toBeTruthy();
    expect(desktop.getByText("Live voice with Lyra")).toBeTruthy();
  }

  fireEvent.click(app.getByRole("switch", { name: "Call active" }));
  expect(app.queryByRole("button", { name: "End voice session" })).toBeNull();
  expect(app.getAllByRole("button", { name: "Speak to Lyra", hidden: true })).toHaveLength(4);
});

test("state selector supports arrow-key selection and wraps focus", () => {
  const app = render(<SubagentCardLab />);
  const idle = app.getByRole("radio", { name: "Idle" });
  const working = app.getByRole("radio", { name: "Working" });
  const done = app.getByRole("radio", { name: "Done" });

  expect(working.getAttribute("tabindex")).toBe("0");
  fireEvent.keyDown(working, { key: "ArrowLeft" });
  expect(idle.getAttribute("aria-checked")).toBe("true");
  expect(document.activeElement).toBe(idle);
  fireEvent.keyDown(idle, { key: "ArrowLeft" });
  expect(done.getAttribute("aria-checked")).toBe("true");
  expect(document.activeElement).toBe(done);
  fireEvent.keyDown(done, { key: "ArrowRight" });
  expect(idle.getAttribute("aria-checked")).toBe("true");
  expect(document.activeElement).toBe(idle);
});

test("auto cycle advances all four states and stops when disabled", () => {
  jest.useFakeTimers();
  const app = render(<SubagentCardLab />);
  const toggle = app.getByRole("switch", { name: "Auto cycle" });

  expect((toggle as HTMLInputElement).checked).toBe(false);
  fireEvent.click(toggle);

  for (const name of ["Blocked", "Done", "Idle", "Working"]) {
    act(() => jest.advanceTimersByTime(2_000));
    expect(app.getByRole("radio", { name }).getAttribute("aria-checked")).toBe("true");
  }

  fireEvent.click(toggle);
  act(() => jest.advanceTimersByTime(6_000));
  expect(app.getByRole("radio", { name: "Working" }).getAttribute("aria-checked")).toBe("true");
});

test("the next card opens its thread without routing Speak clicks through the card", () => {
  const app = render(<SubagentCardLab />);
  const next = within(app.getByRole("region", { name: "Next desktop card" }));
  const thread = next.getByRole("link", { name: "Open Lyra's thread" });
  const speak = next.getByRole("button", { name: "Speak to Lyra" });
  const selected = app.getByRole("switch", { name: "Selected" }) as HTMLInputElement;

  expect(next.queryByText("Open thread")).toBeNull();
  expect(thread.getAttribute("href")).toBe("/sandbox/arcadia/card-lab-preview");
  expect(thread.contains(speak)).toBe(false);
  fireEvent.click(speak);
  expect(selected.checked).toBe(false);
  expect((app.getByRole("switch", { name: "Call active" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(thread);
  expect(selected.checked).toBe(true);
});

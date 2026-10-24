import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { PlanStatusCard } from "@/components/usage/plan-status-card";
import { evaluatePlanBudget, unavailablePlanBudget } from "@/lib/plans/plan-tags";
import { render } from "../helpers/render";

afterEach(cleanup);
const cycle = { start: new Date(), end: new Date(Date.now() + 7 * 86400000) };
const plan = evaluatePlanBudget({
  plan: "pro",
  source: "entitlements",
  cycle,
  usedUsd: 25,
  resetsRemaining: 25,
  resetVersion: "2026-10-01T12:00:00.123456+00:00",
});
describe("weekly plan status", () => {
  test("reset confirmation shows credits and prevents duplicate submissions while pending", async () => {
    let finish!: (message: string | null) => void;
    const reset = mock(
      () =>
        new Promise<string | null>((resolve) => {
          finish = resolve;
        })
    );
    const app = render(<PlanStatusCard plan={plan} onReset={reset} />);
    expect(app.getByText("25 resets left").textContent).toBe("25 resets left");
    expect(Boolean(app.getByText(/Resets in/))).toBe(true);
    fireEvent.click(app.getByRole("button", { name: "Start a fresh window" }));
    expect(reset).not.toHaveBeenCalled();
    const confirm = app.getByRole("button", { name: "Start fresh window" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith(plan.resetVersion);
    await act(async () => {
      finish("Window changed. Refresh Usage.");
    });
    expect(Boolean(app.getByText("Window changed. Refresh Usage."))).toBe(true);
  });
  test("zero credits disable resets; an unavailable budget never appears uncapped", () => {
    const reset = mock(async () => null);
    const app = render(<PlanStatusCard plan={{ ...plan, resetsRemaining: 0 }} onReset={reset} />);
    expect(
      (app.getByRole("button", { name: "Start a fresh window" }) as HTMLButtonElement).disabled
    ).toBe(true);
    app.rerender(<PlanStatusCard plan={unavailablePlanBudget(cycle)} onReset={reset} />);
    expect(Boolean(app.getByText(/Usage check unavailable/))).toBe(true);
    expect(app.queryByText("No weekly spend cap.") === null).toBe(true);
    expect(app.queryByRole("button") === null).toBe(true);
  });
});

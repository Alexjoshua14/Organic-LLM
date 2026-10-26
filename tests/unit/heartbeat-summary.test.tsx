import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, within } from "@testing-library/react";

import { HeartbeatSummary } from "@/app/admin/heartbeats/_components/HeartbeatSummary";
import { HEARTBEAT_STATUSES } from "@/lib/admin/heartbeat-telemetry";
import { heartbeatDashboardFixture } from "../fixtures/heartbeat-dashboard";
import { render } from "../helpers/render";

afterEach(cleanup);

test("associates every percentile with its metric and column, including missing maximums", () => {
  const view = render(<HeartbeatSummary data={heartbeatDashboardFixture} />);
  const table = within(view.getByRole("table"));

  expect(table.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
    "Metric",
    "p50",
    "p95",
    "Max",
  ]);
  expect(table.getByRole("rowheader", { name: "Input tokens" }).parentElement?.textContent).toBe(
    "Input tokens3,5673,627.83,637"
  );
  expect(table.getByRole("rowheader", { name: "Heartbeat s" }).parentElement?.textContent).toBe(
    "Heartbeat s1.02412.4005—"
  );
  expect(table.getByRole("rowheader", { name: "Jev s" }).parentElement?.textContent).toBe(
    "Jev s0.8154.1135—"
  );
  expect(table.getByText("12.4005").getAttribute("title")).toBe("12,400.5 ms");
});

test("outcome shares cover the window rather than the visible page, with keyboard and tap selection", () => {
  const view = render(<HeartbeatSummary data={{ ...heartbeatDashboardFixture, runs: [] }} />);
  const bar = within(view.getByRole("group", { name: "Breakdown of observed poll outcomes" }));
  const notable = bar.getByRole("button", { name: "Notable: 3 polls, 10.7%" });

  expect(bar.getAllByRole("button")).toHaveLength(4);
  const detail = within(view.getByRole("region", { name: "Poll outcomes" })).getByRole("status");
  expect(detail.textContent).toBe("");
  fireEvent.mouseEnter(bar.getByRole("button", { name: "Unchanged: 22 polls, 78.6%" }));
  expect(detail.textContent).toBe("Unchanged22 polls · 78.6%");
  fireEvent.mouseLeave(bar.getByRole("button", { name: "Unchanged: 22 polls, 78.6%" }));
  expect(detail.textContent).toBe("");
  fireEvent.focus(notable);
  expect(notable.getAttribute("aria-pressed")).toBe("true");
  expect(detail.textContent).toBe("Notable3 polls · 10.7%");
  fireEvent.blur(notable);
  expect(notable.getAttribute("aria-pressed")).toBe("false");
  expect(detail.textContent).toBe("");
  fireEvent.click(notable);
  expect(notable.getAttribute("aria-pressed")).toBe("true");
});

test("duration formatting preserves sub-millisecond precision and a measured zero", () => {
  const view = render(
    <HeartbeatSummary
      data={{
        ...heartbeatDashboardFixture,
        summary: {
          ...heartbeatDashboardFixture.summary,
          duration_p50: 0.1,
          snapshot_duration_avg: 0,
        },
      }}
    />
  );

  expect(view.getByTitle("0.1 ms").textContent).toBe("0.0001");
  expect(view.getByTitle("0 ms").parentElement?.textContent).toBe("0 s");
});

test("all supported outcomes render, and zero counts create no invisible chart controls", () => {
  const statuses = HEARTBEAT_STATUSES.map((status) => ({ status, runs: 1 }));
  const data = { ...heartbeatDashboardFixture, statuses };
  const view = render(<HeartbeatSummary data={data} />);

  expect(
    within(view.getByRole("group", { name: "Breakdown of observed poll outcomes" })).getAllByRole(
      "button"
    )
  ).toHaveLength(HEARTBEAT_STATUSES.length);
  view.rerender(
    <HeartbeatSummary
      data={{
        ...data,
        statuses: statuses.map((item) => ({ ...item, runs: 0 })),
        summary: { ...data.summary, runs: 0, input_p50: null, input_p95: null, input_max: null },
      }}
    />
  );
  expect(view.queryByRole("group", { name: "Breakdown of observed poll outcomes" })).toBeNull();
  expect(view.getByText("No heartbeats recorded in this window.")).toBeTruthy();
  expect(view.getByRole("rowheader", { name: "Input tokens" }).parentElement?.textContent).toBe(
    "Input tokens———"
  );
  expect(view.container.textContent).not.toMatch(/NaN|Infinity/);
});

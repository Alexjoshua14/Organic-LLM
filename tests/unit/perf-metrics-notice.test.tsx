import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";

import * as clerk from "@clerk/nextjs";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

// Not restored afterwards: several files stub "@clerk/nextjs" at load time and rely on
// last-writer-wins, so putting the real module back here would break whichever runs next.
mockModulePreservingReal("@clerk/nextjs", clerk, {
  useAuth: (() => ({ isLoaded: true, isSignedIn: true, userId: "user_test" })) as never,
});

import { PerfMetricsNotice } from "@/components/perf/metrics-notice";
import { isPerfReportingAllowed, setPerfSessionAllowed } from "@/lib/perf/enabled";
import { loadPerfConsent, resetPerfConsent } from "@/lib/perf/consent";

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
let puts: unknown[];

function serve(initial: string, putState?: (enabled: boolean) => string) {
  fetchSpy.mockImplementation((async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { enabled: boolean };

      puts.push(body);

      return new Response(JSON.stringify({ state: putState ? putState(body.enabled) : body.enabled ? "on" : "off" }), { status: 200 });
    }

    return new Response(JSON.stringify({ state: initial }), { status: 200 });
  }) as never);
}

beforeEach(() => {
  puts = [];
  fetchSpy = spyOn(globalThis, "fetch");
  setPerfSessionAllowed(true);
  resetPerfConsent();
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  setPerfSessionAllowed(false);
  resetPerfConsent();
});

describe("PerfMetricsNotice", () => {
  test("shown once for an account with no choice; collection starts only after it paints", async () => {
    serve("unset");
    const view = render(<PerfMetricsNotice />);

    expect(puts).toEqual([]);
    await act(async () => loadPerfConsent("user_test"));

    await waitFor(() => expect(view.getByText("Anonymous speed metrics")).toBeTruthy());
    await waitFor(() => expect(puts).toEqual([{ enabled: true }]));
    expect(isPerfReportingAllowed()).toBe(true);
  });

  test("states the facts and links to the code that backs them", async () => {
    serve("unset");
    const view = render(<PerfMetricsNotice />);

    await act(async () => loadPerfConsent("user_test"));
    await waitFor(() => view.getByText("Anonymous speed metrics"));

    expect(view.getByText(/No names, messages, chat IDs or links/)).toBeTruthy();
    expect(view.getByText(/Only admins can see the totals/)).toBeTruthy();
    expect(view.getByRole("link", { name: /See exactly what's recorded/ }).getAttribute("href")).toBe(
      "/privacy-and-security#performance-metrics"
    );
    const code = view.getByRole("link", { name: /read the code that does it/ });

    expect(code.getAttribute("href")).toContain("github.com/Alexjoshua14/Organic-LLM");
    expect(code.getAttribute("href")).toContain("lib/perf/events.ts");
  });

  test("Turn off stops collection at once", async () => {
    serve("unset");
    const view = render(<PerfMetricsNotice />);

    await act(async () => loadPerfConsent("user_test"));
    await waitFor(() => expect(puts).toEqual([{ enabled: true }]));

    fireEvent.click(view.getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(puts).toEqual([{ enabled: true }, { enabled: false }]));
    expect(isPerfReportingAllowed()).toBe(false);
  });

  test.each(["on", "off", "unavailable"])("stays hidden when the choice is already %s", async (initial) => {
    serve(initial);
    const view = render(<PerfMetricsNotice />);

    await act(async () => loadPerfConsent("user_test"));
    await act(async () => {});
    expect(view.queryByText("Anonymous speed metrics")).toBeNull();
    expect(puts).toEqual([]);
  });

  test("if the choice cannot be saved, nothing is collected and the notice goes away", async () => {
    serve("unset", () => "unavailable");
    const view = render(<PerfMetricsNotice />);

    await act(async () => loadPerfConsent("user_test"));
    await waitFor(() => expect(puts).toHaveLength(1));
    await waitFor(() => expect(view.queryByText("Anonymous speed metrics")).toBeNull());
    expect(isPerfReportingAllowed()).toBe(false);
  });
});

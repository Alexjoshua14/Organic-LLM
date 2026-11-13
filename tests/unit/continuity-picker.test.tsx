import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { ContextPicker } from "@/components/continuity/context-picker";
import type { ContinuitySelection } from "@/lib/continuity/schema";

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
const source = {
  kind: "speak-thread",
  threadId: "00000000-0000-4000-8000-000000000001",
  version: "today",
};

test("discovery is explicit and choosing a source does not mint a voice call", async () => {
  const calls: { path: string; body?: Record<string, unknown> }[] = [];
  let selection: ContinuitySelection | undefined;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body });
    if (!body)
      return Response.json({
        candidates: [{ source, label: "Aion architecture", at: null }],
        nextPage: null,
        coverage: "Titles only",
      });
    return Response.json({
      interactionId: "00000000-0000-4000-8000-000000000002",
      revision: body.action === "create" ? 0 : 1,
      selected: body.source ?? null,
    });
  };
  const view = render(
    <ContextPicker
      surface="speak"
      onChange={(value) => {
        selection = value;
      }}
    />
  );
  expect(calls).toHaveLength(0);
  fireEvent.click(view.getByText("Add previous context"));
  expect(calls).toHaveLength(0);
  fireEvent.change(view.getByPlaceholderText("e.g. Aion architecture"), {
    target: { value: "Aion" },
  });
  fireEvent.submit(view.getByRole("button", { name: "Find context" }).closest("form")!);
  await waitFor(() => expect(view.getByText("Aion architecture")).toBeDefined());
  fireEvent.click(view.getByText("Aion architecture"));
  await waitFor(() => expect(selection?.revision).toBe(1));
  expect(calls[1]!.body).toEqual({ action: "create", surface: "speak" });
  expect(calls[2]!.body?.source).toEqual(source);
  expect(calls.every((call) => call.path.startsWith("/api/continuity"))).toBe(true);
});

test("expired selection clears client context and explains the failure", async () => {
  const selected: Array<ContinuitySelection | undefined> = [];
  globalThis.fetch = async (_input, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (!body)
      return Response.json({
        candidates: [{ source, label: "Old conversation", at: null }],
        coverage: "Titles only",
      });
    if (body.action === "create")
      return Response.json({ interactionId: "00000000-0000-4000-8000-000000000002", revision: 0 });
    return Response.json(
      { error: "Context selection expired. Please select it again." },
      { status: 410 }
    );
  };
  const view = render(<ContextPicker surface="stage" onChange={(value) => selected.push(value)} />);
  fireEvent.submit(view.getByRole("button", { name: "Find context" }).closest("form")!);
  await waitFor(() => expect(view.getByText("Old conversation")).toBeDefined());
  fireEvent.click(view.getByText("Old conversation"));
  await waitFor(() => expect(view.getByRole("alert").textContent).toContain("expired"));
  expect(selected).toEqual([undefined]);
});

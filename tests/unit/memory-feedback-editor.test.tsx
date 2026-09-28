import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import type { MemoryFeedbackRow } from "@/lib/schemas/memory-quality";

import { render } from "../helpers/render";

const row: MemoryFeedbackRow = {
  id: "e4180f0e-89f4-49cf-a094-3356c1308799",
  user_id: "owner",
  memory_id: "memory",
  signal: "down",
  source: "memory_lens",
  note: null,
  note_approved_at: null,
  shared_memory: null,
  memory_shared_at: null,
  revision: 3,
  created_at: "2026-09-23T00:00:00Z",
  updated_at: "2026-09-23T00:00:00Z",
};
const approve = mock(async (_input: unknown) => ({
  data: { ...row, note: "User's edited note", revision: 4 },
  error: null,
}));
const removeNote = mock(async (_input: unknown) => ({
  data: { ...row, revision: 4 },
  error: null,
}));
const removeFeedback = mock(async (_input: unknown) => ({ data: true, error: null }));
const previewMemory = mock(async (_input: unknown) => ({
  data: { memoryText: "Exact memory content" },
  error: null,
}));
const shareMemory = mock(async (_input: unknown) => ({
  data: { ...row, shared_memory: "Exact memory content", revision: 4 },
  error: null,
}));
const removeMemory = mock(async (_input: unknown) => ({
  data: { ...row, revision: 4 },
  error: null,
}));

mock.module("@/app/actions/memory-feedback", () => ({
  actionApproveFeedbackNote: approve,
  actionRemoveFeedbackNote: removeNote,
  actionRemoveMemoryFeedback: removeFeedback,
  actionRecordMemoryFeedback: async () => ({ data: row, error: null }),
  actionPreviewFeedbackMemory: previewMemory,
  actionShareFeedbackMemory: shareMemory,
  actionRemoveSharedFeedbackMemory: removeMemory,
}));
const { MemoryFeedbackEditor } = await import("@/components/memory/memory-feedback-editor");
const originalFetch = globalThis.fetch;

beforeEach(() => {
  approve.mockClear();
  removeNote.mockClear();
  removeFeedback.mockClear();
  previewMemory.mockClear();
  shareMemory.mockClear();
  removeMemory.mockClear();
  globalThis.fetch = mock(async () =>
    Response.json({ reply: "Here is a draft.", summary: "Too much detail" })
  ) as unknown as typeof fetch;
});

describe("optional memory copy", () => {
  test("shows admin disclosure and exact preview; cancelling never shares", async () => {
    const ui = render(<MemoryFeedbackEditor row={row} onClose={() => {}} onSaved={() => {}} />);

    expect(previewMemory).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole("button", { name: "Share memory too…" }));
    await waitFor(() => expect(ui.getByText("Exact memory content")).toBeTruthy());
    expect(
      ui.getByText(/This exact memory content will be shared with the admin of Organic LLM/)
    ).toBeTruthy();
    expect(shareMemory).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(ui.queryByText("Exact memory content")).toBeNull();
    expect(shareMemory).not.toHaveBeenCalled();
  });

  test("only the explicit share button approves the reviewed copy", async () => {
    const saved = mock(() => {});
    const ui = render(<MemoryFeedbackEditor row={row} onClose={() => {}} onSaved={saved} />);

    fireEvent.click(ui.getByRole("button", { name: "Share memory too…" }));
    await waitFor(() =>
      expect(ui.getByRole("button", { name: "Share memory with admin" })).toBeTruthy()
    );
    fireEvent.click(ui.getByRole("button", { name: "Share memory with admin" }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(shareMemory).toHaveBeenCalledWith({
      feedbackId: row.id,
      memoryId: row.memory_id,
      revision: row.revision,
      memoryText: "Exact memory content",
      approved: true,
    });
    expect(approve).not.toHaveBeenCalled();
  });

  test("shared copies can be removed independently", async () => {
    const ui = render(
      <MemoryFeedbackEditor
        row={{ ...row, shared_memory: "Previously shared" }}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );

    fireEvent.click(ui.getByRole("button", { name: "Remove shared memory" }));
    await waitFor(() => expect(removeMemory).toHaveBeenCalledTimes(1));
    expect(removeMemory).toHaveBeenCalledWith({
      feedbackId: row.id,
      memoryId: row.memory_id,
      revision: row.revision,
    });
    expect(removeNote).not.toHaveBeenCalled();
    expect(removeFeedback).not.toHaveBeenCalled();
  });
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("optional feedback note", () => {
  test("opening and dismissing the invitation never calls AI or saves a note", () => {
    const close = mock(() => {});
    const ui = render(<MemoryFeedbackEditor row={row} onClose={close} onSaved={() => {}} />);

    expect(ui.getByText("Vote saved")).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
  });

  test("drafting never saves; explicit approval submits the exact edited preview", async () => {
    const saved = mock(() => {});
    const ui = render(<MemoryFeedbackEditor row={row} onClose={() => {}} onSaved={saved} />);

    fireEvent.click(ui.getByRole("button", { name: "Add a note" }));
    fireEvent.change(ui.getByLabelText("What made this memory helpful or unhelpful?"), {
      target: { value: "It kept incidental details." },
    });
    fireEvent.click(ui.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(ui.getByLabelText("Review the note to share")).toBeTruthy());
    expect(approve).not.toHaveBeenCalled();
    fireEvent.change(ui.getByLabelText("Review the note to share"), {
      target: { value: "User's edited note" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Approve & share note" }));
    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    expect(approve.mock.calls[0]?.[0]).toEqual({
      feedbackId: row.id,
      memoryId: row.memory_id,
      revision: 3,
      note: "User's edited note",
      approved: true,
    });
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  });

  test("rejecting a draft and closing never overwrites an existing note", async () => {
    const ui = render(
      <MemoryFeedbackEditor
        row={{ ...row, note: "Already approved" }}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );

    fireEvent.click(ui.getByRole("button", { name: "Edit note" }));
    fireEvent.change(ui.getByLabelText("Review the note to share"), {
      target: { value: "Unapproved replacement" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Refine instead" }));
    fireEvent.click(ui.getByRole("button", { name: "Close" }));
    expect(approve).not.toHaveBeenCalled();
    expect(removeNote).not.toHaveBeenCalled();
  });

  test("removing a note keeps its vote and uses the current revision", async () => {
    const ui = render(
      <MemoryFeedbackEditor
        row={{ ...row, note: "Already approved" }}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );

    fireEvent.click(ui.getByRole("button", { name: "Remove note" }));
    await waitFor(() => expect(removeNote).toHaveBeenCalledTimes(1));
    expect(removeNote.mock.calls[0]?.[0]).toEqual({
      feedbackId: row.id,
      memoryId: row.memory_id,
      revision: 3,
    });
    expect(removeFeedback).not.toHaveBeenCalled();
  });

  test("closing an engaged popover aborts its pending draft request", async () => {
    let signal: AbortSignal | undefined;
    let resolve: (response: Response) => void = () => {};

    globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
      signal = init?.signal ?? undefined;

      return new Promise<Response>((done) => {
        resolve = done;
      });
    }) as unknown as typeof fetch;
    const ui = render(<MemoryFeedbackEditor row={row} onClose={() => {}} onSaved={() => {}} />);

    fireEvent.click(ui.getByRole("button", { name: "Add a note" }));
    fireEvent.change(ui.getByLabelText("What made this memory helpful or unhelpful?"), {
      target: { value: "A draft" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(signal).toBeDefined());
    ui.unmount();
    expect(signal?.aborted).toBe(true);
    resolve(Response.json({ reply: "Draft", summary: "Not saved" }));
    expect(approve).not.toHaveBeenCalled();
  });
});

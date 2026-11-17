import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";

import { ensureDom } from "../helpers/render";

import { useGenUiLabQuestion } from "@/app/sandbox/prototypes/gen-ui-lab/_hooks/use-gen-ui-lab-question";
import { coreInputSnapshots } from "@/lib/core-input/snapshot-store";
import { ChatModels } from "@/lib/schemas/chat";
import type { CoreInputSettings } from "@/lib/core-input/settings";
import type { GenUiLabApiResponse } from "@/lib/sandbox/gen-ui-lab";

ensureDom();
afterEach(cleanup);

const defaults: CoreInputSettings = {
  modelId: ChatModels[0]!.id,
  effort: "auto", contextEffort: "quick", webSearch: false, memories: false, speechFriendly: false,
};

function deferred() {
  let resolve!: (response: GenUiLabApiResponse) => void;
  const promise = new Promise<GenUiLabApiResponse>((done) => { resolve = done; });

  return { promise, resolve };
}

describe("Gen UI Lab side questions", () => {
  test("starts closed and closing discards messages and ephemeral settings", async () => {
    const onResponse = mock(() => {});
    const view = renderHook(() => useGenUiLabQuestion({
      request: async () => ({ message: "Use the comparison lens." }), onResponse,
    }));
    expect(view.result.current.isOpen).toBe(false);
    act(() => view.result.current.open());
    const scope = view.result.current.scope!;
    coreInputSnapshots.writeEphemeral(scope.key, { ...defaults, memories: true });
    await act(async () => view.result.current.sendQuestion("How do I compare these?"));
    expect(view.result.current.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(onResponse).toHaveBeenCalledTimes(1);
    act(() => view.result.current.close());
    expect(view.result.current.messages).toEqual([]);
    expect(view.result.current.scope).toBeUndefined();
    expect(coreInputSnapshots.resolve(scope, defaults)).toEqual(defaults);
    act(() => view.result.current.open());
    expect(view.result.current.scope?.key).not.toBe(scope.key);
    expect(view.result.current.messages).toEqual([]);
  });

  test("closing aborts and an ignored abort cannot apply stale content after reopening", async () => {
    const pending = deferred();
    let signal!: AbortSignal;
    const onResponse = mock(() => {});
    const view = renderHook(() => useGenUiLabQuestion({
      request: (_question, requestSignal) => { signal = requestSignal; return pending.promise; }, onResponse,
    }));
    act(() => view.result.current.open());
    let sending!: Promise<void>;
    act(() => { sending = view.result.current.sendQuestion("Generate another example"); });
    act(() => view.result.current.close());
    expect(signal.aborted).toBe(true);
    act(() => view.result.current.open());
    await act(async () => { pending.resolve({ message: "Stale answer", selection: { blockType: "answer-card", viewMode: "focus" } }); await sending; });
    expect(onResponse).not.toHaveBeenCalled();
    expect(view.result.current.messages).toEqual([]);
    expect(view.result.current.status).toBe("ready");
  });

  test("unmount aborts outstanding work and forgets its settings", async () => {
    const pending = deferred();
    let signal!: AbortSignal;
    const onResponse = mock(() => {});
    const view = renderHook(() => useGenUiLabQuestion({
      request: (_question, requestSignal) => { signal = requestSignal; return pending.promise; }, onResponse,
    }));
    act(() => view.result.current.open());
    const scope = view.result.current.scope!;
    coreInputSnapshots.writeEphemeral(scope.key, { ...defaults, memories: true });
    let sending!: Promise<void>;
    act(() => { sending = view.result.current.sendQuestion("Explain this example"); });
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(coreInputSnapshots.resolve(scope, defaults)).toEqual(defaults);
    pending.resolve({ message: "Too late" });
    await sending;
    expect(onResponse).not.toHaveBeenCalled();
  });
});

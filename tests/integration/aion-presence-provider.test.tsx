import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { render } from "../helpers/render";
import {
  AionPresenceProvider,
  useAionPresence,
} from "@/app/sandbox/aion/_components/aion-presence-provider";
import { aionPresenceStore, setAionPresenceEnabled } from "@/lib/aion/presence/event-bus";

let presence: ReturnType<typeof useAionPresence>;
const originalFetch = globalThis.fetch;
const initial = { ...aionPresenceStore.getState() };
function Probe() {
  presence = useAionPresence();
  return null;
}
function mount() {
  return render(
    <AionPresenceProvider>
      <Probe />
    </AionPresenceProvider>
  );
}
const flushDebounce = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 290));
  });
const emit = (kind: "button" | "message" = "button", label = "Save") =>
  act(() => {
    presence.emit({ kind, label, surface: "test" });
  });
beforeEach(() =>
  aionPresenceStore.setState(() => ({
    ...initial,
    ledger: [],
    decisions: [],
    lastTurn: null,
    error: null,
    busy: false,
    enabled: true,
    lastTurnAt: Date.now(),
  }))
);
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("Aion presence lifecycle", () => {
  test("pausing awareness cancels an already debounced event", async () => {
    const fetchMock = mock(async () => Response.json({ silent: true, text: null, threadId: null }));
    globalThis.fetch = fetchMock as typeof fetch;
    mount();
    emit();
    act(() => setAionPresenceEnabled(false));
    await flushDebounce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(aionPresenceStore.getState().ledger).toHaveLength(1);
  });
  test("failed requests retain their ledger and expose an error", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ error: "Unavailable" }, { status: 503 })
    ) as typeof fetch;
    mount();
    emit();
    await flushDebounce();
    expect(aionPresenceStore.getState()).toMatchObject({
      busy: false,
      phase: "idle",
      lastTurn: null,
    });
    expect(aionPresenceStore.getState().error).toContain("could not process");
    expect(aionPresenceStore.getState().ledger).toHaveLength(1);
  });
  test("a full event cancels the pending micro-turn and sends through the registered chat", async () => {
    const fetchMock = mock(async () => Response.json({}));
    globalThis.fetch = fetchMock as typeof fetch;
    const send = mock(async (_text: string) => {});
    mount();
    presence.registerChatSend(send);
    emit();
    emit("message", "What changed?");
    await flushDebounce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain("What changed?");
    expect(send.mock.calls[0][0]).toContain("Save");
    expect(aionPresenceStore.getState().busy).toBe(false);
  });
  test("a typed full turn aborts ambient work without overwriting its thinking state", async () => {
    let signal: AbortSignal | null = null;
    let finish!: (response: Response) => void;
    globalThis.fetch = mock((_url: unknown, init?: RequestInit) => {
      signal = init!.signal!;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    }) as typeof fetch;
    mount();
    emit();
    await flushDebounce();
    act(() => presence.reportChatStatus("submitted"));
    expect(signal!.aborted).toBe(true);
    await act(async () => {
      finish(Response.json({ silent: true, text: null, threadId: null }));
    });
    expect(aionPresenceStore.getState()).toMatchObject({
      busy: true,
      phase: "thinking",
      lastTurn: null,
    });
    act(() => presence.reportChatStatus("ready"));
    expect(aionPresenceStore.getState().busy).toBe(false);
  });
  test("events arriving during a micro-turn survive its acknowledgement", async () => {
    let finish!: (response: Response) => void;
    globalThis.fetch = mock(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    ) as typeof fetch;
    mount();
    emit();
    await flushDebounce();
    emit("button", "New event");
    await act(async () => {
      finish(Response.json({ silent: true, text: null, threadId: null }));
    });
    expect(aionPresenceStore.getState().ledger.map((entry) => entry.label)).toEqual(["New event"]);
  });
});

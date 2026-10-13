/**
 * Hands a live Realtime call "what the user is looking at", one screen item at a time.
 *
 * `useRealtimeVoice` owns the call; this owns everything about the screen item in it:
 *
 * - **Dedupe.** The same surface key is never fetched twice in a row, so navigating away and back
 *   costs nothing and a fast double-registration cannot push twice.
 * - **Latest wins.** A reply for a surface the user has already left is dropped — clicking through
 *   rabbit-hole nodes overlaps requests constantly — as is one that lands after the call changed.
 * - **Replace, not pile up.** Each item carries our own id; the next push adds its item, then
 *   deletes the previous one, so the model never holds two descriptions of the screen and never
 *   has none. See `lib/speak/ambient-item.ts`.
 * - **Nothing to describe still replaces.** An empty body becomes `AMBIENT_CLEARED_BODY`, or the
 *   model would go on describing the page the user left.
 *
 * The body is built server-side (summaries and compiled docs need privileged reads) and forwarded
 * down the data channel from here, because the channel lives in the browser. No `response.create`
 * follows, which is what keeps it silent.
 *
 * Plain closure state rather than a hook, like `createVoiceIdleTimer`: none of it needs to render,
 * and it is testable without React. The one thing the UI does read — the snapshot for the dev
 * "Sees:" chip — is reported through `onSnapshot`.
 */

import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";
import type { VoiceTransport } from "@/lib/speak/transport/voice-transport";

import { screenSurfaceKey } from "@/lib/schemas/speak-screen-context";
import {
  AMBIENT_CLEARED_BODY,
  AMBIENT_EVENT_PREFIX,
  buildAmbientContextItem,
  buildAmbientDeleteEvent,
} from "@/lib/speak/ambient-item";

/**
 * What the model was last told about the screen, for the dev "Sees:" chip. `reason` explains an
 * empty body — the screen was replaced with {@link AMBIENT_CLEARED_BODY} instead.
 */
export type VoiceScreenContextSnapshot = {
  surfaceKey: string;
  label: string;
  body: string;
  reason?: string;
  at: number;
};

/** The call as delivery needs it. Read fresh at every step: a call can end mid-request. */
export type ScreenContextChannel = {
  sessionId: string | null;
  transport: VoiceTransport | null;
  connected: boolean;
};

export type ScreenContextDelivery = {
  /** Pushes `surface` unless it is the one last sent. Never throws; a failed push is dropped. */
  send(surface: SpeakScreenSurface): Promise<void>;
  /**
   * Forgets the previous conversation — its item id, its key, its snapshot. Call on every connect
   * and teardown: a new call has no item to delete, and deleting one provokes an error.
   */
  reset(): void;
};

type ContextReply = { body?: string; label?: string; reason?: string };

export function createScreenContextDelivery({
  channel,
  onSnapshot,
}: {
  channel: () => ScreenContextChannel;
  onSnapshot: (snapshot: VoiceScreenContextSnapshot | null) => void;
}): ScreenContextDelivery {
  /** Last surface claimed, so a repeat is skipped and a superseded reply can be recognised. */
  let claimedKey: string | null = null;
  /** Our id for the screen item in the conversation, so the next push can delete it. */
  let itemId: string | null = null;
  /** Never reset: ids stay unique across reconnects within the page. */
  let seq = 0;

  const release = (key: string) => {
    if (claimedKey === key) claimedKey = null;
  };

  async function send(surface: SpeakScreenSurface): Promise<void> {
    const { sessionId, transport, connected } = channel();

    if (!sessionId || !transport || !connected) return;

    const key = screenSurfaceKey(surface);

    if (claimedKey === key) return;

    // Claimed before awaiting, so a second registration of the same surface cannot push twice.
    claimedKey = key;

    try {
      const res = await fetch("/api/ai/speak/realtime/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, surface }),
      });

      if (!res.ok) {
        release(key);

        return;
      }

      const data = (await res.json()) as ContextReply;
      const now = channel();

      if (claimedKey !== key || now.transport !== transport || !now.connected) return;

      const body = data.body?.trim() || AMBIENT_CLEARED_BODY;
      const next = `${AMBIENT_EVENT_PREFIX}item_${++seq}`;
      const previous = itemId;

      // Add before delete, so there is never a moment with no screen item at all.
      transport.send(
        buildAmbientContextItem(body, { itemId: next, eventId: `${AMBIENT_EVENT_PREFIX}add_${seq}` })!
      );
      itemId = next;

      if (previous) {
        transport.send(buildAmbientDeleteEvent(previous, `${AMBIENT_EVENT_PREFIX}del_${seq}`));
      }

      onSnapshot({
        surfaceKey: key,
        label: data.label ?? surface.kind,
        body,
        reason: data.reason,
        at: Date.now(),
      });
    } catch {
      // Ambient awareness is an enhancement; a failed push must never disturb the call.
      release(key);
    }
  }

  function reset() {
    claimedKey = null;
    itemId = null;
    onSnapshot(null);
  }

  return { send, reset };
}

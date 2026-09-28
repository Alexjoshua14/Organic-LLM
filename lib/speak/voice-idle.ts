/**
 * Ends a live call after a stretch where nothing is happening on either side.
 *
 * An open Realtime call costs while it sits there: it holds a concurrency slot, runs the
 * wall-clock meter toward `SPEAK_SESSION_MAX_MINUTES`, and keeps a hot mic that room noise can
 * turn into a billed turn. So the call stops itself once a conversation has clearly gone quiet,
 * and picking back up is a single tap on the paused bar.
 *
 * "Quiet" means **all** of these at once, continuously, for {@link SPEAK_IDLE_PAUSE_MS}:
 *
 * - the user is not speaking (server VAD `speech_started` → `speech_stopped`);
 * - no response is in flight (`response.created` → `response.done`) — the model is not thinking;
 * - no model audio is playing (`output_audio_buffer.started` → `stopped` / `cleared`) — on WebRTC
 *   playback outlives `response.done`, so a long answer is not cut off mid-sentence;
 * - no tool call is executing — a slow gen-UI render is work, not silence.
 *
 * Any of them starting stops the countdown; the last one ending restarts it from zero, so the
 * window is measured from the end of the most recent activity rather than accumulated.
 *
 * An activity whose end event never arrives keeps the call open — the same behaviour as before
 * this existed — rather than risking a pause while the model is mid-answer.
 */

/**
 * Approved range **15–20s** (`docs/speak/decisions/20260922-idle-auto-pause.md`). The top of the
 * range, because a person thinking before they answer is the common false positive, and resuming
 * costs a reconnect (~1s) plus a re-sent thread preamble. Move within the range; outside it, ask.
 */
export const SPEAK_IDLE_PAUSE_MS = 20_000;

export type VoiceActivity = "user-speech" | "response" | "playback" | `tool:${string}`;

export type VoiceIdleTimer = {
  /** Something started; the countdown is suspended until every activity has ended. */
  begin(activity: VoiceActivity): void;
  /** Ending an activity that never began is ignored, so duplicate end events are harmless. */
  end(activity: VoiceActivity): void;
  /** Forget all activity and start a fresh countdown — call when a call connects. */
  reset(): void;
  /** Forget all activity and cancel the countdown — call on teardown. */
  stop(): void;
};

export function createVoiceIdleTimer({
  timeoutMs = SPEAK_IDLE_PAUSE_MS,
  onIdle,
}: {
  timeoutMs?: number;
  onIdle: () => void;
}): VoiceIdleTimer {
  const active = new Set<VoiceActivity>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const disarm = () => {
    if (timer === null) return;

    clearTimeout(timer);
    timer = null;
  };

  const arm = () => {
    disarm();
    timer = setTimeout(() => {
      timer = null;
      if (active.size === 0) onIdle();
    }, timeoutMs);
  };

  return {
    begin(activity) {
      active.add(activity);
      disarm();
    },
    end(activity) {
      if (!active.delete(activity)) return;
      if (active.size === 0) arm();
    },
    reset() {
      active.clear();
      arm();
    },
    stop() {
      active.clear();
      disarm();
    },
  };
}

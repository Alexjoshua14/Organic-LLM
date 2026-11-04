/**
 * Sequencing for the voice persona's respond-or-hold gate, one per live call.
 *
 * Transcripts queue until the user stops speaking; consecutive ones are decided together. A new
 * utterance cancels an in-flight decision so the next one sees everything said. A decision
 * never speaks over a reply already playing, and a late decision from a replaced call is
 * dropped. A failed decision answers rather than going silent.
 */

export type PersonaTurnDecision = {
  respond: boolean;
  kind: string;
  label: string;
};

/** If a requested reply never reports back, the gate unblocks after this long. */
const RESPONSE_WATCHDOG_MS = 30_000;

export function createPersonaTurnController(options: {
  decide: (text: string, signal: AbortSignal) => Promise<PersonaTurnDecision>;
  /** Sends `response.create`; false when the channel is closed. */
  respond: () => boolean;
  onDecision: (decision: PersonaTurnDecision) => void;
  onPending: (pending: boolean) => void;
}) {
  let speaking = false;
  let responding = false;
  let pending: string[] = [];
  let generation = 0;
  let controller: AbortController | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const seen = new Set<string>();

  const clearWatchdog = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
  };

  const cancel = () => {
    generation++;
    if (controller) {
      controller.abort();
      controller = null;
      options.onPending(false);
    }
  };

  const flush = async (): Promise<void> => {
    if (speaking || responding || controller || pending.length === 0) return;

    const count = pending.length;
    const version = generation;
    const request = new AbortController();

    controller = request;
    options.onPending(true);

    let decision: PersonaTurnDecision;

    try {
      decision = await options.decide(pending.join("\n"), request.signal);
    } catch {
      decision = { respond: true, kind: "question", label: "Heard" };
    }

    if (request.signal.aborted || version !== generation) return;

    controller = null;
    pending.splice(0, count);
    options.onPending(false);
    options.onDecision(decision);

    if (decision.respond && options.respond()) {
      responding = true;
      clearWatchdog();
      watchdog = setTimeout(() => {
        responding = false;
        void flush();
      }, RESPONSE_WATCHDOG_MS);

      return;
    }
    void flush();
  };

  return {
    speechStarted() {
      speaking = true;
      cancel();
    },
    speechStopped() {
      speaking = false;
      void flush();
    },
    transcript(text: string, itemId?: string | null) {
      if (itemId) {
        if (seen.has(itemId)) return;
        seen.add(itemId);
      }
      if (!text.trim()) return;
      pending.push(text.trim());
      cancel();
      void flush();
    },
    responseStarted() {
      responding = true;
      clearWatchdog();
    },
    responseFinished() {
      responding = false;
      clearWatchdog();
      void flush();
    },
    reset() {
      cancel();
      clearWatchdog();
      speaking = false;
      responding = false;
      pending = [];
      seen.clear();
    },
  };
}

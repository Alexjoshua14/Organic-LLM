/**
 * Other first-visit notices (the anonymous-metrics notice, for one) register here while they are
 * on screen. Onboarding waits for them so a new account sees one thing at a time.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
const active = new Set<string>();
let blocked = false;

function publish() {
  const next = active.size > 0;

  if (next === blocked) return;
  blocked = next;

  for (const listener of listeners) listener();
}

/** Marks a notice as visible; returns the cleanup that clears it. */
export function holdOnboarding(id: string): () => void {
  active.add(id);
  publish();

  return () => {
    active.delete(id);
    publish();
  };
}

export function isOnboardingHeld(): boolean {
  return blocked;
}

export function subscribeOnboardingHold(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

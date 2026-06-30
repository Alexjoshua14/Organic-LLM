type Listener = () => void;

const listeners = new Set<Listener>();

let explicitGuideRequested = false;

export function requestFeatureGuideResume(): void {
  explicitGuideRequested = true;

  for (const listener of listeners) {
    listener();
  }
}

export function consumeExplicitFeatureGuideRequest(): boolean {
  if (!explicitGuideRequested) return false;

  explicitGuideRequested = false;

  return true;
}

export function isExplicitFeatureGuideRequested(): boolean {
  return explicitGuideRequested;
}

export function subscribeExplicitFeatureGuideRequest(listener: Listener): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function resetExplicitFeatureGuideRequestForTests(): void {
  explicitGuideRequested = false;

  for (const listener of listeners) {
    listener();
  }
}

import type { AutoFeatureTipId } from "./feature-tips";

/**
 * Mounted `<FeatureTip>` anchors, keyed by instance so two mounted copies of one tip (two composers,
 * say) register separately and one unmount never removes the other. Module-level, so `<FeatureTip>`
 * needs no provider.
 */
export type FeatureTipInstance = {
  key: string;
  id: AutoFeatureTipId;
  showWhen: boolean;
  getElement: () => HTMLElement | null;
};

type Listener = () => void;

const listeners = new Set<Listener>();
let instances: readonly FeatureTipInstance[] = [];

function publish(next: readonly FeatureTipInstance[]) {
  instances = next;

  for (const listener of listeners) listener();
}

export function registerFeatureTip(instance: FeatureTipInstance): void {
  const index = instances.findIndex((entry) => entry.key === instance.key);
  const existing = index >= 0 ? instances[index] : undefined;

  if (
    existing &&
    existing.id === instance.id &&
    existing.showWhen === instance.showWhen &&
    existing.getElement === instance.getElement
  ) {
    return;
  }

  publish(
    index >= 0
      ? instances.map((entry, i) => (i === index ? instance : entry))
      : [...instances, instance]
  );
}

export function unregisterFeatureTip(key: string): void {
  if (!instances.some((entry) => entry.key === key)) return;

  publish(instances.filter((entry) => entry.key !== key));
}

export function subscribeFeatureTips(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getFeatureTipInstances(): readonly FeatureTipInstance[] {
  return instances;
}

const EMPTY: readonly FeatureTipInstance[] = [];

export function getFeatureTipServerInstances(): readonly FeatureTipInstance[] {
  return EMPTY;
}

export function resetFeatureTipRegistryForTests(): void {
  publish(EMPTY);
}

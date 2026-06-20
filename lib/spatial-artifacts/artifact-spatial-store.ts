import type { ArtifactRect, ArtifactSpatialEntry } from "./spatial-types";
import { rectFromVector4 } from "./spatial-types";

type SlotRegistration = {
  artifactId: string;
  role: string;
  measureEl: HTMLElement | null;
};

type Listener = () => void;

export class ArtifactSpatialStore {
  private entries = new Map<string, ArtifactSpatialEntry>();
  private slots = new Map<string, SlotRegistration>();
  private slotRects = new Map<string, ArtifactRect>();
  private listeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<Listener>();
  private focusArtifactId: string | null = null;
  private stageEl: HTMLElement | null = null;

  setStage(el: HTMLElement | null): void {
    this.stageEl = el;
  }

  getStage(): HTMLElement | null {
    return this.stageEl;
  }

  registerSlot(slotKey: string, artifactId: string, role: string, measureEl: HTMLElement | null): void {
    this.slots.set(slotKey, { artifactId, role, measureEl });
  }

  unregisterSlot(slotKey: string): void {
    this.slots.delete(slotKey);
    this.slotRects.delete(slotKey);
  }

  subscribe(artifactId: string, cb: Listener): () => void {
    if (!this.listeners.has(artifactId)) {
      this.listeners.set(artifactId, new Set());
    }
    this.listeners.get(artifactId)!.add(cb);

    return () => this.listeners.get(artifactId)?.delete(cb);
  }

  subscribeAll(cb: Listener): () => void {
    this.globalListeners.add(cb);

    return () => this.globalListeners.delete(cb);
  }

  private notify(artifactId?: string): void {
    if (artifactId) {
      this.listeners.get(artifactId)?.forEach((cb) => cb());
    }
    this.globalListeners.forEach((cb) => cb());
  }

  getEntry(artifactId: string): ArtifactSpatialEntry {
    if (!this.entries.has(artifactId)) {
      this.entries.set(artifactId, {
        artifactId,
        activeSlotKey: null,
        lastRect: null,
        targetRect: null,
        visible: false,
      });
    }

    return this.entries.get(artifactId)!;
  }

  getLastRect(artifactId: string): ArtifactRect | null {
    return this.getEntry(artifactId).lastRect;
  }

  getTargetRect(artifactId: string): ArtifactRect | null {
    return this.getEntry(artifactId).targetRect;
  }

  getSlotRect(slotKey: string): ArtifactRect | null {
    return this.slotRects.get(slotKey) ?? null;
  }

  setFocusArtifact(artifactId: string | null): void {
    this.focusArtifactId = artifactId;
    this.notify();
  }

  getFocusArtifact(): string | null {
    return this.focusArtifactId;
  }

  measureSlot(slotKey: string, rect: ArtifactRect): void {
    this.slotRects.set(slotKey, rect);
  }

  commitSlotTargets(measureFn: (el: HTMLElement, stage: HTMLElement) => ArtifactRect): void {
    const stage = this.stageEl;

    if (!stage) return;

    for (const [slotKey, slot] of this.slots) {
      if (!slot.measureEl) continue;

      this.slotRects.set(slotKey, measureFn(slot.measureEl, stage));
    }

    this.notify();
  }

  requestMorph(artifactId: string, slotKey: string): void {
    const rect = this.slotRects.get(slotKey);

    if (!rect) return;

    const entry = this.getEntry(artifactId);

    entry.activeSlotKey = slotKey;
    entry.targetRect = rect;
    entry.visible = true;
    this.notify(artifactId);
  }

  settle(artifactId: string, rect: ArtifactRect): void {
    const entry = this.getEntry(artifactId);

    entry.lastRect = rect;
    this.notify(artifactId);
  }

  hideArtifact(artifactId: string): void {
    const entry = this.getEntry(artifactId);

    entry.visible = false;
    entry.activeSlotKey = null;
    this.notify(artifactId);
  }

  static measureElement(el: HTMLElement, stage: HTMLElement): ArtifactRect {
    const stageBox = stage.getBoundingClientRect();
    const box = el.getBoundingClientRect();

    return rectFromVector4({
      x: box.left - stageBox.left,
      y: box.top - stageBox.top,
      w: box.width,
      h: box.height,
    });
  }
}

export function createArtifactSpatialStore(): ArtifactSpatialStore {
  return new ArtifactSpatialStore();
}

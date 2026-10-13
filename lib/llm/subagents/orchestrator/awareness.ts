import type { WorkerAwarenessEvent } from "@/lib/schemas/subagent-runtime";

export type WorkerAwarenessListener = (event: WorkerAwarenessEvent) => void;

/**
 * In-process bus so the orchestrator stays aware of worker progress, milestones,
 * and completion. Separate from Speak-shell rules (only milestones are spoken);
 * this bus is orchestrator state, not TTS policy.
 */
export class OrchestratorAwarenessBus {
  private readonly byOrchestrator = new Map<string, Set<WorkerAwarenessListener>>();
  private readonly history = new Map<string, WorkerAwarenessEvent[]>();

  subscribe(orchestratorId: string, listener: WorkerAwarenessListener): () => void {
    let set = this.byOrchestrator.get(orchestratorId);
    if (!set) {
      set = new Set();
      this.byOrchestrator.set(orchestratorId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.byOrchestrator.delete(orchestratorId);
    };
  }

  publish(orchestratorId: string, event: WorkerAwarenessEvent): void {
    const prior = this.history.get(orchestratorId) ?? [];
    prior.push(event);
    this.history.set(orchestratorId, prior);

    const listeners = this.byOrchestrator.get(orchestratorId);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(event);
    }
  }

  /** Snapshot of events the orchestrator has already received (tests + HUD). */
  list(orchestratorId: string): readonly WorkerAwarenessEvent[] {
    return this.history.get(orchestratorId) ?? [];
  }

  clear(orchestratorId: string): void {
    this.history.delete(orchestratorId);
    this.byOrchestrator.delete(orchestratorId);
  }
}

/** Shared default bus for the process (sandbox / single-node). */
export const defaultOrchestratorAwarenessBus = new OrchestratorAwarenessBus();

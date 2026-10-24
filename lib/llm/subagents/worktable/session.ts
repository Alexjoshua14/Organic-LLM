import type { WorktableOutcome } from "@/lib/llm/subagents/worktable/operations";
import type { Worktable } from "@/lib/llm/subagents/worktable/types";

/**
 * Persistence for one orchestrator's worktable. `revision` is an opaque optimistic-lock token
 * (null before the first save). Implementations must scope every call to the owner.
 */
export type WorktableStore = {
  /** Null when worktable storage is unavailable (e.g. the migration has not run). */
  load(): Promise<{ worktable: Worktable; revision: string | null } | null>;
  save(
    worktable: Worktable,
    previousRevision: string | null
  ): Promise<{ status: "saved"; revision: string } | { status: "conflict" | "unavailable" }>;
};

export type WorktableSession = {
  /** Current table, or null when storage is unavailable. */
  read(): Promise<Worktable | null>;
  /**
   * Apply a pure edit and persist it. Edits run one at a time — the model may call worktable
   * tools in parallel — and a concurrent writer from another request is retried on fresh state.
   */
  mutate<T>(apply: (worktable: Worktable) => WorktableOutcome<T>): Promise<WorktableOutcome<T>>;
};

export const WORKTABLE_UNAVAILABLE_ERROR =
  "The worktable is unavailable right now. Pass context inline with dispatch_subagent items instead.";

const SAVE_ATTEMPTS = 3;

export function createWorktableSession(store: WorktableStore): WorktableSession {
  let cached: { worktable: Worktable; revision: string | null } | null | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);

    queue = next.catch(() => undefined);

    return next;
  };

  const current = async () => {
    if (cached === undefined) cached = await store.load().catch(() => null);

    return cached;
  };

  return {
    read: () => serial(async () => (await current())?.worktable ?? null),
    mutate: (apply) =>
      serial(async () => {
        for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
          const state = await current();

          if (!state) return { ok: false, error: WORKTABLE_UNAVAILABLE_ERROR };
          const outcome = apply(state.worktable);

          if (!outcome.ok) return outcome;
          const saved = await store
            .save(outcome.worktable, state.revision)
            .catch(() => ({ status: "unavailable" as const }));

          if (saved.status === "saved") {
            cached = { worktable: outcome.worktable, revision: saved.revision };

            return outcome;
          }
          if (saved.status === "unavailable")
            return { ok: false, error: WORKTABLE_UNAVAILABLE_ERROR };
          cached = undefined;
        }

        return { ok: false, error: "The worktable is busy. Try again." };
      }),
  };
}

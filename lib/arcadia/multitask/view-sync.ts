/**
 * Same-browser sync for Arcadia multitask view (per thread).
 * Payload is only thread id + boolean — no message content.
 */

export const MULTITASK_VIEW_STORAGE_PREFIX = "organic-llm:arcadia-multitask-view:";
export const MULTITASK_VIEW_BROADCAST_CHANNEL = "organic-llm-arcadia-multitask-view";

export type MultitaskViewSyncPayload = {
  threadId: string;
  enabled: boolean;
  /** Epoch ms when this value was written. */
  updatedAt: number;
};

export function multitaskViewStorageKey(threadId: string): string {
  return `${MULTITASK_VIEW_STORAGE_PREFIX}${threadId}`;
}

export function parseMultitaskViewStored(
  raw: string | null | undefined
): MultitaskViewSyncPayload | null {
  if (!raw?.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<MultitaskViewSyncPayload>;

    if (typeof parsed.threadId !== "string" || typeof parsed.enabled !== "boolean") {
      return null;
    }

    return {
      threadId: parsed.threadId,
      enabled: parsed.enabled,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function serializeMultitaskViewStored(payload: MultitaskViewSyncPayload): string {
  return JSON.stringify(payload);
}

/** Read local cache for a thread. Default when missing: off (false). */
export function readMultitaskViewLocal(threadId: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const parsed = parseMultitaskViewStored(
      window.localStorage.getItem(multitaskViewStorageKey(threadId))
    );

    if (!parsed || parsed.threadId !== threadId) return false;

    return parsed.enabled;
  } catch {
    return false;
  }
}

/** Write local cache and notify other tabs (storage event + BroadcastChannel). */
export function writeMultitaskViewLocal(
  threadId: string,
  enabled: boolean
): MultitaskViewSyncPayload {
  const payload: MultitaskViewSyncPayload = {
    threadId,
    enabled,
    updatedAt: Date.now(),
  };

  if (typeof window === "undefined") return payload;

  try {
    window.localStorage.setItem(
      multitaskViewStorageKey(threadId),
      serializeMultitaskViewStored(payload)
    );
  } catch {
    /* private mode / quota — still try BroadcastChannel */
  }

  try {
    const channel = new BroadcastChannel(MULTITASK_VIEW_BROADCAST_CHANNEL);

    channel.postMessage(payload);
    channel.close();
  } catch {
    /* BroadcastChannel unsupported */
  }

  return payload;
}

import type { CoreInputSettings } from "./settings";

import { CONTEXT_EFFORT_LEVELS } from "@/lib/memory/context-effort";
import { CHAT_EFFORT_LEVELS } from "@/lib/schemas/chat-effort";
import { ChatModels } from "@/lib/schemas/chat";

/**
 * Bit-packed CoreInput snapshots.
 *
 * One cache entry is 128 bits: a 53-bit scope-key hash and a 37-bit packed value, each held
 * in a float64 slot. Both stay below 2^53, so they round-trip exactly through JSON, Postgres
 * `bigint`, and `Float64Array` with no BigInt.
 *
 * Value layout (least significant first):
 *
 * | bits  | field          | notes                                            |
 * |-------|----------------|--------------------------------------------------|
 * | 0–3   | version        | 0 never occurs, so 0 doubles as "empty"          |
 * | 4–6   | effort         | index into CHAT_EFFORT_LEVELS (8 levels)         |
 * | 7–8   | context effort | index into CONTEXT_EFFORT_LEVELS (3 levels)      |
 * | 9     | web search     |                                                  |
 * | 10    | memories       |                                                  |
 * | 11    | speech friendly|                                                  |
 * | 12    | reserved       |                                                  |
 * | 13–36 | model code     | 24-bit hash of the model id, see {@link modelCode} |
 *
 * Bump {@link SNAPSHOT_CODEC_VERSION} when the layout changes; entries with any other
 * version decode as absent rather than as wrong settings.
 */
export const SNAPSHOT_CODEC_VERSION = 1;

const LOW_BITS = 13;
const LOW_SPAN = 2 ** LOW_BITS;
const MODEL_CODE_SPAN = 2 ** 24;

/** Bytes per cache entry: two float64 slots. */
export const SNAPSHOT_ENTRY_BYTES = 16;

/**
 * cyrb53 (bryc, public domain): a fast 53-bit string hash with good avalanche.
 *
 * At the 4,096-entry cache cap the birthday bound puts the chance of any two scope keys
 * colliding near 1e-9. A collision would make two scopes share settings, never corrupt them,
 * and the server keeps full scope keys, so a collision cannot spread past one device.
 */
export function cyrb53(input: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);

    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function hashScopeKey(scopeKey: string): number {
  return cyrb53(scopeKey);
}

/**
 * 24-bit code for a model id. A hash rather than an index so the registry can reorder or
 * drop models without remapping stored snapshots; a unit test asserts the current registry
 * has no collisions. A code with no registry match decodes to `modelId: null`.
 */
export function modelCode(modelId: string): number {
  return cyrb53(modelId, 0x6d6f64) % MODEL_CODE_SPAN;
}

let modelIdByCode: Map<number, string> | null = null;

function modelIdForCode(code: number): string | null {
  if (!modelIdByCode) {
    modelIdByCode = new Map(ChatModels.map((model) => [modelCode(model.id), model.id]));
  }

  return modelIdByCode.get(code) ?? null;
}

export type DecodedSnapshot = Omit<CoreInputSettings, "modelId"> & {
  /** `null` when the stored model is no longer in the registry. */
  modelId: string | null;
};

export function encodeSnapshot(settings: CoreInputSettings): number {
  const effortIndex = Math.max(
    0,
    CHAT_EFFORT_LEVELS.findIndex((row) => row.id === settings.effort)
  );
  const contextIndex = Math.max(0, CONTEXT_EFFORT_LEVELS.indexOf(settings.contextEffort));
  const low =
    SNAPSHOT_CODEC_VERSION |
    (effortIndex << 4) |
    (contextIndex << 7) |
    (Number(settings.webSearch) << 9) |
    (Number(settings.memories) << 10) |
    (Number(settings.speechFriendly) << 11);

  // Multiplication, not a shift: JS bitwise operators truncate to 32 bits.
  return modelCode(settings.modelId) * LOW_SPAN + low;
}

export function decodeSnapshot(value: number): DecodedSnapshot | null {
  if (!Number.isSafeInteger(value) || value <= 0) return null;

  const low = value % LOW_SPAN;
  const code = Math.floor(value / LOW_SPAN);

  if ((low & 0b1111) !== SNAPSHOT_CODEC_VERSION || code >= MODEL_CODE_SPAN) return null;

  const effort = CHAT_EFFORT_LEVELS[(low >> 4) & 0b111];
  const contextEffort = CONTEXT_EFFORT_LEVELS[(low >> 7) & 0b11];

  if (!effort || !contextEffort) return null;

  return {
    modelId: modelIdForCode(code),
    effort: effort.id,
    contextEffort,
    webSearch: ((low >> 9) & 1) === 1,
    memories: ((low >> 10) & 1) === 1,
    speechFriendly: ((low >> 11) & 1) === 1,
  };
}

/** `[keyHash, value]` pairs, oldest first. */
export type SnapshotEntries = ReadonlyArray<readonly [number, number]>;

/** Packs entries into base64: 16 bytes each, little-endian float64 pairs. */
export function packSnapshotEntries(entries: SnapshotEntries): string {
  const bytes = new Uint8Array(entries.length * SNAPSHOT_ENTRY_BYTES);
  const view = new DataView(bytes.buffer);

  entries.forEach(([keyHash, value], index) => {
    view.setFloat64(index * SNAPSHOT_ENTRY_BYTES, keyHash, true);
    view.setFloat64(index * SNAPSHOT_ENTRY_BYTES + 8, value, true);
  });

  let binary = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}

/** Inverse of {@link packSnapshotEntries}; malformed input yields no entries. */
export function unpackSnapshotEntries(packed: string): Array<[number, number]> {
  let binary: string;

  try {
    binary = atob(packed);
  } catch {
    return [];
  }

  if (binary.length % SNAPSHOT_ENTRY_BYTES !== 0) return [];

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const view = new DataView(bytes.buffer);
  const entries: Array<[number, number]> = [];

  for (let offset = 0; offset < bytes.length; offset += SNAPSHOT_ENTRY_BYTES) {
    const keyHash = view.getFloat64(offset, true);
    const value = view.getFloat64(offset + 8, true);

    if (Number.isSafeInteger(keyHash) && Number.isSafeInteger(value)) {
      entries.push([keyHash, value]);
    }
  }

  return entries;
}

/**
 * Blob storage interface for subagent identity images.
 *
 * Local filesystem today; swap the implementation for S3 (or Supabase Storage)
 * without changing callers. Do not commit generated binaries.
 */

export type PutIdentityBlobInput = {
  /** Stable key, typically `subagent-identity/{agentId}.{ext}`. */
  key: string;
  bytes: Uint8Array;
  mediaType: string;
};

export type PutIdentityBlobResult = {
  key: string;
  /** App-relative or absolute URL clients can load. */
  url: string;
  mediaType: string;
};

export type IdentityBlobStore = {
  get(key: string): Promise<{ bytes: Uint8Array; mediaType: string } | null>;
  put(input: PutIdentityBlobInput): Promise<PutIdentityBlobResult>;
  /** Resolve a stored key to a fetchable URL (may be file:// or /api/… later). */
  urlForKey(key: string): string;
};

export type IdentityImageMetaStore = {
  get(agentId: string): Promise<import("@/lib/schemas/subagent-runtime").SubagentIdentityImageRecord | null>;
  put(
    record: import("@/lib/schemas/subagent-runtime").SubagentIdentityImageRecord
  ): Promise<void>;
};

import type {
  SubagentIdentity,
  SubagentIdentityImageRecord,
} from "@/lib/schemas/subagent-runtime";

import {
  generateSubagentIdentityImage,
  type IdentityImageGenerator,
} from "@/lib/llm/subagents/identity/generate";
import { createLocalIdentityBlobStore } from "@/lib/llm/subagents/identity/local-blob-store";
import { createLocalIdentityMetaStore } from "@/lib/llm/subagents/identity/local-meta-store";
import type {
  IdentityBlobStore,
  IdentityImageMetaStore,
} from "@/lib/llm/subagents/identity/storage";

export type EnsureIdentityImageDeps = {
  blobStore?: IdentityBlobStore;
  metaStore?: IdentityImageMetaStore;
  generate?: IdentityImageGenerator;
  now?: () => Date;
};

/**
 * Stable per-subagent identity image: reuse stored mark; generate only when missing.
 * Call when a subagent (worker or orchestrator character) is created.
 */
export async function ensureSubagentIdentityImage(
  identity: SubagentIdentity,
  deps: EnsureIdentityImageDeps = {}
): Promise<SubagentIdentityImageRecord> {
  const metaStore = deps.metaStore ?? createLocalIdentityMetaStore();
  const existing = await metaStore.get(identity.agentId);
  if (existing) return existing;

  const blobStore = deps.blobStore ?? createLocalIdentityBlobStore();
  const generate = deps.generate ?? generateSubagentIdentityImage;
  const generated = await generate(identity);

  const ext =
    generated.mediaType === "image/webp"
      ? "webp"
      : generated.mediaType === "image/jpeg"
        ? "jpg"
        : "png";
  const storageKey = `${identity.agentId}.${ext}`;
  const put = await blobStore.put({
    key: storageKey,
    bytes: generated.bytes,
    mediaType: generated.mediaType,
  });

  const record: SubagentIdentityImageRecord = {
    agentId: identity.agentId,
    url: put.url,
    mediaType: put.mediaType,
    prompt: generated.prompt,
    createdAt: (deps.now ?? (() => new Date()))().toISOString(),
    storageKey: put.key,
  };

  await metaStore.put(record);

  return record;
}

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type {
  IdentityBlobStore,
  PutIdentityBlobInput,
  PutIdentityBlobResult,
} from "@/lib/llm/subagents/identity/storage";

/**
 * Local filesystem blob store under `.data/subagent-identity/` (gitignored).
 * Swap for S3/Supabase Storage later via the same {@link IdentityBlobStore} interface.
 */
export function createLocalIdentityBlobStore(options?: {
  rootDir?: string;
}): IdentityBlobStore {
  const rootDir =
    options?.rootDir ?? path.join(process.cwd(), ".data", "subagent-identity", "blobs");

  async function ensureRoot(): Promise<void> {
    await mkdir(rootDir, { recursive: true });
  }

  return {
    async get(key) {
      const filePath = path.join(rootDir, key);
      try {
        const bytes = new Uint8Array(await readFile(filePath));
        const ext = path.extname(key).toLowerCase();
        const mediaType =
          ext === ".png"
            ? "image/png"
            : ext === ".webp"
              ? "image/webp"
              : ext === ".jpg" || ext === ".jpeg"
                ? "image/jpeg"
                : "application/octet-stream";

        return { bytes, mediaType };
      } catch {
        return null;
      }
    },

    async put(input: PutIdentityBlobInput): Promise<PutIdentityBlobResult> {
      await ensureRoot();
      const filePath = path.join(rootDir, input.key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, input.bytes);

      return {
        key: input.key,
        url: `file://${filePath}`,
        mediaType: input.mediaType,
      };
    },

    urlForKey(key: string): string {
      return `file://${path.join(rootDir, key)}`;
    },
  };
}

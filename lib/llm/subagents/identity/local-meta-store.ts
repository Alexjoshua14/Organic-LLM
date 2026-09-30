import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import {
  SubagentIdentityImageRecordSchema,
  type SubagentIdentityImageRecord,
} from "@/lib/schemas/subagent-runtime";

import type { IdentityImageMetaStore } from "@/lib/llm/subagents/identity/storage";

export function createLocalIdentityMetaStore(options?: {
  rootDir?: string;
}): IdentityImageMetaStore {
  const rootDir =
    options?.rootDir ?? path.join(process.cwd(), ".data", "subagent-identity", "meta");

  async function ensureRoot(): Promise<void> {
    await mkdir(rootDir, { recursive: true });
  }

  function fileFor(agentId: string): string {
    const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, "_");

    return path.join(rootDir, `${safe}.json`);
  }

  return {
    async get(agentId) {
      try {
        const raw = await readFile(fileFor(agentId), "utf8");
        const parsed = SubagentIdentityImageRecordSchema.safeParse(JSON.parse(raw));

        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },

    async put(record: SubagentIdentityImageRecord) {
      await ensureRoot();
      const validated = SubagentIdentityImageRecordSchema.parse(record);
      await writeFile(fileFor(validated.agentId), JSON.stringify(validated, null, 2), "utf8");
    },
  };
}

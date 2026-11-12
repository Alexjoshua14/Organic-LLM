import "server-only";

import { mkdir, readFile, rename, rm, writeFile, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { SubscriptionError } from "./policy";

const tokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  idToken: z.string().min(1),
  expiresAt: z.number(),
  scopes: z.array(z.string()),
});
const stateSchema = z.object({
  hostId: z.string(),
  ownerId: z.string(),
  registration: z
    .object({
      clientId: z.string(),
      subject: z.string(),
      email: z.string().optional(),
      tokens: tokensSchema.optional(),
    })
    .optional(),
  pending: z
    .object({
      state: z.string(),
      nonce: z.string(),
      verifier: z.string(),
      browser: z.string(),
      redirectUri: z.string(),
      expiresAt: z.number(),
      clientId: z.string().optional(),
    })
    .optional(),
});
export type SubscriptionState = z.infer<typeof stateSchema>;

/** One owner and one selected registration per local installation for this first slice. */
export class SubscriptionStore {
  constructor(readonly directory = join(homedir(), ".config", "organic-llm", "chatgpt")) {}

  private async directoryReady() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.directory);
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) {
      throw new SubscriptionError(
        "The subscription credential directory must be owner-only (0700).",
        503
      );
    }
  }

  async read(ownerId: string): Promise<SubscriptionState> {
    const path = join(this.directory, "connection.json");
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
        throw new SubscriptionError(
          "The subscription credential file must be owner-only (0600).",
          503
        );
      }
      const state = stateSchema.parse(JSON.parse(await readFile(path, "utf8")));
      if (state.ownerId !== ownerId)
        throw new SubscriptionError(
          "This subscription belongs to a different installation owner.",
          403
        );
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { ownerId, hostId: `urn:uuid:${randomUUID()}` };
    }
  }

  async write(state: SubscriptionState) {
    const temporary = join(this.directory, `${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600, flag: "wx" });
      await rename(temporary, join(this.directory, "connection.json"));
    } finally {
      await rm(temporary, { force: true });
    }
  }

  /** Cross-process lock serializes rotating refresh tokens. Never break a possibly-live lock. */
  async locked<T>(ownerId: string, fn: (state: SubscriptionState) => Promise<T>): Promise<T> {
    await this.directoryReady();
    const lock = join(this.directory, "connection.lock");
    try {
      await mkdir(lock, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new SubscriptionError("The subscription connection is busy. Try again shortly.", 409);
      }
      throw error;
    }
    try {
      return await fn(await this.read(ownerId));
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}
export const subscriptionStore = new SubscriptionStore();

/** A separate lease spans a streamed turn; sign-in/disconnect cannot replace its account mid-turn. */
export async function acquireSubscriptionTurn(store: SubscriptionStore, ownerId: string) {
  await store.locked(ownerId, async () => {});
  const path = join(store.directory, "turn.lock");
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new SubscriptionError(
        "A subscription turn is still running. Stop it or wait before changing the connection.",
        409
      );
    }
    throw error;
  }
  return () => rm(path, { recursive: true, force: true });
}

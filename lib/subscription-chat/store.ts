import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { SubscriptionError } from "./policy";
import { subscriptionRepository, type SubscriptionRepository } from "./repository";

import { encryptForStorage, decryptFromStorage } from "@/lib/crypto/message-encryption";

const tokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  scopes: z.array(z.string()),
  refreshUncertain: z.boolean().optional(),
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

const context = (ownerId: string) => ({
  userId: ownerId,
  threadId: "chatgpt",
  fieldName: "subscription_connection.state" as const,
});

/** Durable, tenant-bound ciphertext only. No plaintext fallback, including development. */
export class SubscriptionStore {
  private active = new AsyncLocalStorage<{ ownerId: string; lease: string }>();
  constructor(
    readonly repo: SubscriptionRepository = subscriptionRepository,
    readonly encrypt = encryptForStorage,
    readonly decrypt = decryptFromStorage
  ) {}

  async read(ownerId: string): Promise<SubscriptionState> {
    const ciphertext = await this.repo.read(ownerId);

    if (!ciphertext) return { ownerId, hostId: `urn:uuid:${randomUUID()}` };
    if (!ciphertext.startsWith("enc:"))
      throw new SubscriptionError("Connection storage is unavailable.", 503);
    const state = stateSchema.parse(JSON.parse(this.decrypt(ciphertext, context(ownerId))));

    if (state.ownerId !== ownerId)
      throw new SubscriptionError("Connection ownership did not match.", 403);

    return state;
  }

  async write(state: SubscriptionState) {
    const active = this.active.getStore();

    if (!active || active.ownerId !== state.ownerId)
      throw new SubscriptionError("Connection write requires its owner lease.", 409);
    const ciphertext = this.encrypt(
      JSON.stringify(stateSchema.parse(state)),
      context(state.ownerId)
    );

    if (!ciphertext.startsWith("enc:"))
      throw new SubscriptionError("Credential encryption is required.", 503);
    await this.repo.write(state.ownerId, active.lease, ciphertext);
  }

  async locked<T>(ownerId: string, fn: (state: SubscriptionState) => Promise<T>): Promise<T> {
    const lease = randomUUID();

    if (!(await this.repo.acquire(ownerId, "connection", lease)))
      throw new SubscriptionError("The subscription connection is busy. Try again shortly.", 409);
    try {
      return await this.active.run({ ownerId, lease }, async () => fn(await this.read(ownerId)));
    } finally {
      await this.repo.release(ownerId, "connection", lease);
    }
  }
}
export const subscriptionStore = new SubscriptionStore();

export async function acquireSubscriptionTurn(store: SubscriptionStore, ownerId: string) {
  const lease = randomUUID();

  if (!(await store.repo.acquire(ownerId, "turn", lease)))
    throw new SubscriptionError("A subscription turn is still running. Try again shortly.", 409);

  return () => store.repo.release(ownerId, "turn", lease);
}

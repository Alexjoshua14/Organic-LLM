import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  createContinuityStore,
  CONTINUITY_TTL_SECONDS,
  type ContinuityStoreDeps,
} from "@/lib/continuity/store";
import { ContinuitySourceSchema, type ContinuitySource } from "@/lib/continuity/schema";
import { createMessageEncryptionService } from "@/lib/crypto/message-encryption";

const original = process.env.ORGANIC_LLM_ROOT_SECRET;
beforeAll(() => {
  process.env.ORGANIC_LLM_ROOT_SECRET ??= "continuity-tests-secret";
});
afterAll(() => {
  if (original === undefined) delete process.env.ORGANIC_LLM_ROOT_SECRET;
  else process.env.ORGANIC_LLM_ROOT_SECRET = original;
});
const values = new Map<string, string>();
let now = 1_000_000;
let ttls: number[] = [];
let conflict = false;
const deps: ContinuityStoreDeps = {
  now: () => now,
  get: async (key) => values.get(key) ?? null,
  create: async (key, value, ttl) => {
    if (values.has(key)) return false;
    values.set(key, value);
    ttls.push(ttl);
    return true;
  },
  cas: async (key, expected, next, ttl) => {
    if (conflict || values.get(key) !== expected) return false;
    values.set(key, next);
    ttls.push(ttl);
    return true;
  },
};
const store = createContinuityStore(deps);
const source: ContinuitySource = {
  kind: "speak-thread",
  threadId: "00000000-0000-4000-8000-000000000001",
  version: "2026-11-13T00:00:00Z",
};
const validate = async () => {};
beforeEach(() => {
  values.clear();
  now = 1_000_000;
  ttls = [];
  conflict = false;
});
async function created() {
  return store.create("owner", "speak");
}
const args = (id: string, revision = 0) => ({
  interactionId: id,
  expectedRevision: revision,
  requestId: crypto.randomUUID(),
  source,
});

describe("encrypted continuity interaction", () => {
  test("uses encrypted reference-only storage with the approved TTL", async () => {
    const record = await created();
    const raw = [...values.values()][0]!;
    expect(raw.startsWith("enc:")).toBe(true);
    expect(raw).not.toContain(record.interactionId);
    expect(raw).not.toContain("receipts");
    expect(ttls).toEqual([CONTINUITY_TTL_SECONDS]);
    expect((await store.get("owner", record.interactionId)).surface).toBe("speak");
    await expect(store.get("another-owner", record.interactionId)).rejects.toMatchObject({
      status: 410,
    });
  });
  test("expires at the boundary and selection extends inactivity time", async () => {
    const record = await created();
    now += 1000;
    await store.select("owner", args(record.interactionId), validate);
    expect((await store.get("owner", record.interactionId)).expiresAt).toBe(now + 86_400_000);
    now += 86_400_000;
    await expect(store.get("owner", record.interactionId)).rejects.toMatchObject({ status: 410 });
  });
  test("replays the exact receipt after a later selection", async () => {
    const record = await created();
    const request = args(record.interactionId);
    const first = await store.select("owner", request, validate);
    await store.select("owner", { ...args(record.interactionId, 1), source: null }, validate);
    expect(await store.select("owner", request, validate)).toEqual(first);
    expect((await store.get("owner", record.interactionId)).revision).toBe(2);
  });
  test("same key with changed payload and stale revisions fail", async () => {
    const record = await created();
    const request = args(record.interactionId);
    await store.select("owner", request, validate);
    await expect(
      store.select("owner", { ...request, source: null }, validate)
    ).rejects.toMatchObject({ status: 409 });
    await expect(store.select("owner", args(record.interactionId), validate)).rejects.toMatchObject(
      { status: 409 }
    );
  });
  test("validation runs on receipt replay and before writes", async () => {
    const record = await created();
    const request = args(record.interactionId);
    await store.select("owner", request, validate);
    await expect(
      store.select("owner", request, async () => {
        throw new Error("Deleted");
      })
    ).rejects.toThrow("Deleted");
    expect((await store.get("owner", record.interactionId)).revision).toBe(1);
  });
  test("concurrent selection only commits one revision", async () => {
    const record = await created();
    const results = await Promise.allSettled([
      store.select("owner", args(record.interactionId), validate),
      store.select("owner", args(record.interactionId), validate),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect((await store.get("owner", record.interactionId)).revision).toBe(1);
  });
  test("separate interactions remain independent", async () => {
    const a = await created();
    const b = await created();
    await store.select("owner", args(a.interactionId), validate);
    expect((await store.get("owner", b.interactionId)).selected).toBeNull();
  });
  test("receipt list is capped at 64 and CAS failures do not write", async () => {
    const record = await created();
    for (let i = 0; i < 65; i++)
      await store.select("owner", args(record.interactionId, i), validate);
    expect((await store.get("owner", record.interactionId)).receipts).toHaveLength(64);
    conflict = true;
    await expect(
      store.select("owner", args(record.interactionId, 65), validate)
    ).rejects.toMatchObject({ status: 409 });
    expect((await store.get("owner", record.interactionId)).revision).toBe(65);
  });
  test("refuses plaintext and authenticates owner, interaction and field", async () => {
    const record = await created();
    const key = [...values.keys()][0]!;
    values.set(key, JSON.stringify(record));
    await expect(store.get("owner", record.interactionId)).rejects.toMatchObject({ status: 410 });
    const cryptoService = createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "test" },
    });
    const context = {
      userId: "owner",
      threadId: `continuity:${record.interactionId}:v1`,
      fieldName: "continuity.interaction" as const,
    };
    const sealed = cryptoService.encryptForStorage("private", context);
    expect(() =>
      cryptoService.decryptFromStorage(sealed, { ...context, userId: "other" })
    ).toThrow();
    expect(() =>
      cryptoService.decryptFromStorage(sealed, { ...context, threadId: "another" })
    ).toThrow();
    expect(() =>
      cryptoService.decryptFromStorage(sealed, { ...context, fieldName: "stage.events" })
    ).toThrow();
  });
  test("source schema excludes archive refs, negative revisions and free-form content", () => {
    expect(
      ContinuitySourceSchema.safeParse({ ...source, transcript: "private text" }).success
    ).toBe(false);
    expect(
      ContinuitySourceSchema.safeParse({ kind: "stage-exchange", eventRevision: 1 }).success
    ).toBe(false);
    expect(
      ContinuitySourceSchema.safeParse({
        kind: "stage-artifact",
        artifactId: source.threadId,
        workspaceRevision: -1,
      }).success
    ).toBe(false);
  });
});

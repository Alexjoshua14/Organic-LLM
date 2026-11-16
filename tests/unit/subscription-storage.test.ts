import { expect, test } from "bun:test";
import { MemorySubscriptionRepository } from "../helpers/subscription-repository";
import { SubscriptionStore, acquireSubscriptionTurn } from "@/lib/subscription-chat/store";
import { createMessageEncryptionService } from "@/lib/crypto/message-encryption";
import { SubscriptionConnection } from "@/lib/subscription-chat/connection";
import { readSubscriptionInput } from "@/lib/subscription-chat/input";
import { PLAN_SCOPE } from "@/lib/subscription-chat/policy";

const crypto = createMessageEncryptionService({
  activeKeyId: "k1",
  keyRegistry: { k1: "a".repeat(64) },
});
function fixture() {
  const repo = new MemorySubscriptionRepository();
  const store = new SubscriptionStore(repo, crypto.encryptForStorage, crypto.decryptFromStorage);
  return { repo, store };
}
async function connect(store: SubscriptionStore, owner: string) {
  await store.locked(owner, async (state) => {
    state.registration = {
      clientId: "issued",
      subject: owner,
      tokens: {
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        expiresAt: 0,
        scopes: [PLAN_SCOPE],
      },
    };
    await store.write(state);
  });
}
test("credentials are ciphertext and copying one user's row cannot decrypt for another", async () => {
  const { store, repo } = fixture();
  await connect(store, "alice");
  expect(repo.rows.get("alice")).not.toContain("refresh-secret");
  expect((await store.read("bob")).registration).toBeUndefined();
  repo.rows.set("bob", repo.rows.get("alice")!);
  await expect(store.read("bob")).rejects.toThrow();
});
test("plaintext reads and encryption failures fail closed in all environments", async () => {
  const { store, repo } = fixture();
  repo.rows.set("alice", 'plain:{"ownerId":"alice"}');
  await expect(store.read("alice")).rejects.toThrow("unavailable");
  const unsafe = new SubscriptionStore(repo, (value) => value, crypto.decryptFromStorage);
  await expect(connect(unsafe, "bob")).rejects.toThrow("encryption");
  expect(repo.rows.has("bob")).toBe(false);
});
test("cross-user writes are refused even inside an acquired lease", async () => {
  const { store } = fixture();
  await expect(
    store.locked("alice", async (state) => {
      await store.write({ ...state, ownerId: "bob" });
    })
  ).rejects.toThrow("owner lease");
});
test("a turn blocks only its own user and releases independently", async () => {
  const { store } = fixture();
  const alice = await acquireSubscriptionTurn(store, "alice");
  const bob = await acquireSubscriptionTurn(store, "bob");
  await expect(acquireSubscriptionTurn(store, "alice")).rejects.toThrow("still running");
  await bob();
  await alice();
});
test("expired workers cannot write or release a replacement lease", async () => {
  const { store, repo } = fixture();
  await store.locked("alice", async (state) => {
    repo.now += 180_001;
    expect(await repo.acquire("alice", "connection", "replacement")).toBe(true);
    await expect(store.write(state)).rejects.toThrow("Expired lease");
  });
  expect(repo.leases.get("alice:connection")?.token).toBe("replacement");
});
test("callback replay under another Organic user cannot exchange a code", async () => {
  const { store } = fixture();
  let exchanges = 0;
  const connection = new SubscriptionConnection(store, (async () => {
    exchanges++;
    throw new Error("must not exchange");
  }) as typeof fetch);
  const login = await connection.start("alice", "http://127.0.0.1:3000");
  const pending = (await store.read("alice")).pending!;
  await expect(
    connection.complete(
      "bob",
      new URL(`${pending.redirectUri}?state=${pending.state}&code=code&client_id=issued`),
      login.browser
    )
  ).rejects.toThrow("verified");
  expect(exchanges).toBe(0);
  expect((await store.read("alice")).pending).toBeDefined();
});
test("temporary refresh rejection preserves credentials; ambiguous transport blocks replay without erasing them", async () => {
  for (const ambiguous of [false, true]) {
    const { store } = fixture();
    await connect(store, "alice");
    let calls = 0;
    const connection = new SubscriptionConnection(store, (async () => {
      calls++;
      if (ambiguous) throw new Error("network");
      return Response.json({ error: "temporarily_unavailable" }, { status: 503 });
    }) as typeof fetch);
    await expect(connection.access("alice")).rejects.toThrow();
    const tokens = (await store.read("alice")).registration?.tokens;
    expect(tokens?.refreshToken).toBe("refresh-secret");
    expect(tokens?.refreshUncertain ?? false).toBe(ambiguous);
    if (ambiguous) {
      await expect(connection.access("alice")).rejects.toThrow("interrupted");
      expect(calls).toBe(1);
    }
  }
});
test("stalled upload times out and cancels before any connection lease is needed", async () => {
  let canceled = false;
  const body = new ReadableStream({
    cancel() {
      canceled = true;
    },
  });
  const request = new Request("http://127.0.0.1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
  await expect(readSubscriptionInput(request, 10)).rejects.toThrow("timed out");
  expect(canceled).toBe(true);
});
test("aborted uploads stop immediately", async () => {
  const controller = new AbortController();
  const request = new Request("http://127.0.0.1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new ReadableStream(),
    signal: controller.signal,
    duplex: "half",
  } as RequestInit);
  controller.abort();
  await expect(readSubscriptionInput(request)).rejects.toThrow("interrupted");
});

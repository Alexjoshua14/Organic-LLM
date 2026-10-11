import { describe, expect, test } from "bun:test";

import { researchLedgerClient } from "../helpers/research-ledger-client";
import { createSupabaseResearchLedgerStore } from "@/data/supabase/research-ledger";
import { createMessageEncryptionService } from "@/lib/crypto/message-encryption";
import { captureSources, emptyResearchLedger } from "@/lib/llm/subagents/research/ledger";

const encryption = createMessageEncryptionService({
  activeKeyId: "test",
  keyRegistry: { test: "test-only-ledger-key" },
});
const NOW = "2026-10-10T12:00:00.000Z";
function fixture() {
  const state = researchLedgerClient();
  state.tables.threads!.push({ id: "thread", owner_id: "owner", research_ledger_id: null });
  const store = createSupabaseResearchLedgerStore(
    { threadId: "thread", ownerId: "owner" },
    { client: state.client, encryption }
  );
  return { ...state, store };
}
function ledger() {
  const captured = captureSources(
    emptyResearchLedger(),
    [
      {
        url: "https://example.com/report",
        title: "Report",
        provider: "exa",
        text: "The study included 120 participants.",
        publishedAt: null,
        locations: [],
        excerptOnly: false,
        truncated: false,
      },
    ],
    NOW
  );
  if (!captured.ok) throw new Error("Fixture failed");
  return captured.ledger;
}

describe("independent research ledger rows", () => {
  test("stores only the FK on threads; encrypts and guards payload writes by owner, ledger id and revision", async () => {
    const f = fixture();
    expect((await f.store.load())!.ledger).toEqual(emptyResearchLedger());
    const id = f.tables.threads![0]!.research_ledger_id as string;
    expect(id).toBeTruthy();
    const saved = await f.store.save(ledger(), null);
    expect(saved.status).toBe("saved");
    const row = f.tables.research_ledgers![0]!;
    expect(row.payload).toMatch(/^enc:/);
    expect(row.payload).not.toContain("120 participants");
    expect(f.tables.threads![0]!).not.toHaveProperty("payload");
    expect((await f.store.load())!.ledger.sources[0]!.text).toContain("120 participants");
    expect(
      f.queries.filter(
        (query) => query.table === "research_ledgers" && query.operation === "update"
      )[0]!.filters
    ).toEqual([
      ["id", id],
      ["owner_id", "owner"],
      ["payload_rev", null],
    ]);
    expect(await f.store.save(ledger(), "stale")).toEqual({ status: "conflict" });
    expect(await f.store.save(ledger(), row.payload_rev as string)).toMatchObject({
      status: "saved",
    });
    const wrongContext = {
      userId: "owner",
      threadId: "thread",
      fieldName: "research_ledgers.payload" as const,
    };
    expect(() => encryption.decryptFromStorage(row.payload as string, wrongContext)).toThrow();
  });

  test("rechecks thread and ledger ownership for reads and writes", async () => {
    const f = fixture();
    await f.store.load();
    await f.store.save(ledger(), null);
    const other = createSupabaseResearchLedgerStore(
      { threadId: "thread", ownerId: "other" },
      { client: f.client, encryption }
    );
    expect(await other.load()).toBeNull();
    f.tables.threads![0]!.owner_id = "other";
    expect(
      await f.store.save(ledger(), f.tables.research_ledgers![0]!.payload_rev as string)
    ).toEqual({ status: "unavailable" });
    // Even a malformed/cross-owner link cannot bypass the ledger's owner filter.
    expect(await other.load()).toBeNull();
  });

  test("a ledger can be referenced by another owned thread without rebinding or copying its ciphertext", async () => {
    const f = fixture();
    await f.store.load();
    await f.store.save(ledger(), null);
    f.tables.threads!.push({
      id: "second",
      owner_id: "owner",
      research_ledger_id: f.tables.threads![0]!.research_ledger_id,
    });
    const second = createSupabaseResearchLedgerStore(
      { threadId: "second", ownerId: "owner" },
      { client: f.client, encryption }
    );
    expect((await second.load())!.ledger.sources).toHaveLength(1);
    expect(f.tables.research_ledgers).toHaveLength(1);
  });

  test("concurrent initialization converges on one FK and removes the unused candidate", async () => {
    const f = fixture();
    const second = createSupabaseResearchLedgerStore(
      { threadId: "thread", ownerId: "owner" },
      { client: f.client, encryption }
    );
    const results = await Promise.all([f.store.load(), second.load()]);
    expect(results.every(Boolean)).toBe(true);
    expect(f.tables.research_ledgers).toHaveLength(1);
    expect(f.tables.research_ledgers![0]!.id).toBe(f.tables.threads![0]!.research_ledger_id);
  });

  test("a changed FK causes a conflict rather than writing evidence into the new ledger", async () => {
    const f = fixture();
    await f.store.load();
    f.tables.threads![0]!.research_ledger_id = "new-ledger";
    expect(await f.store.save(ledger(), null)).toEqual({ status: "conflict" });
    expect(f.tables.research_ledgers![0]!.payload).toBeNull();
  });

  test("migration backfill reads legacy ciphertext and upgrades its ledger AAD on save", async () => {
    const f = fixture();
    f.tables.threads![0]!.research_ledger_id = "ledger-id";
    f.tables.research_ledgers!.push({
      id: "ledger-id",
      owner_id: "owner",
      payload: encryption.encryptForStorage(JSON.stringify(ledger()), {
        userId: "owner",
        threadId: "thread",
        fieldName: "threads.research_ledger",
      }),
      payload_rev: "old-revision",
      legacy_thread_id: "thread",
    });
    const state = (await f.store.load())!;
    expect(state.ledger.sources).toHaveLength(1);
    expect(await f.store.save(state.ledger, state.revision)).toMatchObject({ status: "saved" });
    const row = f.tables.research_ledgers![0]!;
    expect(row.legacy_thread_id).toBeNull();
    expect(
      JSON.parse(
        encryption.decryptFromStorage(row.payload as string, {
          userId: "owner",
          threadId: "ledger-id",
          fieldName: "research_ledgers.payload",
        })
      ).sources
    ).toHaveLength(1);
  });

  test("missing migration or corrupt ciphertext does not silently create an empty replacement", async () => {
    const f = fixture();
    delete f.tables.research_ledgers;
    expect(await f.store.load()).toBeNull();
    const corrupt = fixture();
    await corrupt.store.load();
    corrupt.tables.research_ledgers![0]!.payload = "bad ciphertext";
    expect(await corrupt.store.load()).toBeNull();
    expect(corrupt.tables.research_ledgers).toHaveLength(1);
  });
});

import { describe, expect, test } from "bun:test";
import { boundThreadContext, extractThreadPointers, parseThreadPointer, threadReferenceMarker, THREAD_REFERENCE_FALLBACK, validThreadEssence } from "@/lib/chat/thread-reference";
import { createThreadReferenceMetrics } from "@/lib/chat/thread-reference-metrics";

const ID = "38f7c69e-d5a6-4a2d-a25b-4de75f21b61f";

describe("thread pointers", () => {
  test("accepts only whole UUIDs or explicit pointers, normalized", () => {
    expect(parseThreadPointer(` ${ID.toUpperCase()} `)).toBe(ID);
    expect(parseThreadPointer(`[thread:${ID}]`)).toBe(ID);
    for (const text of [`open ${ID}`, `https://example.org/chat/${ID}`, `[thread:${ID}] extra`, "../../threads", "not-a-thread", `${ID},owner_id.neq.x`]) expect(parseThreadPointer(text)).toBeNull();
    expect(threadReferenceMarker(ID)).toBe(`[thread:${ID}]`);
  });
  test("extracts a deduplicated bounded set of explicit pointers", () => {
    expect(extractThreadPointers(`${ID}\n[thread:${ID}]\n[thread:${ID.toUpperCase()}]`)).toEqual([ID]);
    expect(extractThreadPointers(Array.from({ length: 12 }, (_, n) => `[thread:38f7c69e-d5a6-4a2d-a25b-${String(n).padStart(12, "0")}]`).join("\n"))).toHaveLength(8);
  });
  test("enforces eight words and an honest bounded fallback", () => {
    expect(validThreadEssence(THREAD_REFERENCE_FALLBACK)).toBe(true);
    expect(validThreadEssence("one two three four five six seven eight")).toBe(true);
    expect(validThreadEssence("one two three")).toBe(false);
    expect(validThreadEssence("one two three four five six seven\neight")).toBe(false);
    expect(validThreadEssence(`${"x".repeat(241)} two three four five six seven eight`)).toBe(false);
  });
  test("caps context by message count and total characters, preserving newest turns", () => {
    const context = boundThreadContext(Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `${i}:` + "x".repeat(4_000) })));
    expect(context.length).toBeLessThanOrEqual(6);
    expect(context.reduce((sum, message) => sum + message.text.length, 0)).toBeLessThanOrEqual(8_000);
    expect(context.at(-1)?.text.startsWith("39:")).toBe(true);
  });
});

describe("thread performance metrics", () => {
  test("reports real nearest-rank percentiles and bounded recent samples", () => {
    const metrics = createThreadReferenceMetrics();
    expect(metrics.snapshot()[0]?.p50).toBeNull();
    for (let i = 1; i <= 100; i += 1) metrics.record("resolve", i);
    expect(metrics.snapshot()[0]).toMatchObject({ total: 100, samples: 100, p50: 50, p95: 95, p99: 99 });
    for (let i = 101; i <= 1_000; i += 1) metrics.record("resolve", i);
    expect(metrics.snapshot()[0]).toMatchObject({ total: 1_000, samples: 512, p50: 744, p95: 975, p99: 995 });
    metrics.record("resolve", NaN);
    metrics.record("resolve", -1);
    expect(metrics.snapshot()[0]?.total).toBe(1_000);
  });
});

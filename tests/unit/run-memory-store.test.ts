import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { runMemoryStore } from "@/lib/memory/run-memory-store";

describe("runMemoryStore", () => {
  let savedSecret: string | undefined;

  beforeEach(() => {
    savedSecret = process.env.MEMORY_API_SECRET;
    // Set a secret so the unrelated "missing secret" warning path stays quiet.
    process.env.MEMORY_API_SECRET = "test-secret";
  });

  afterEach(() => {
    if (savedSecret === undefined) {
      delete process.env.MEMORY_API_SECRET;
    } else {
      process.env.MEMORY_API_SECRET = savedSecret;
    }
  });

  test("returns the operation result on success", async () => {
    const result = await runMemoryStore("contextLabel", async () => 42);

    expect(result).toBe(42);
  });

  test("logs a MEMORY_API hint and re-throws on failure", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("qdrant 401");

    let caught: unknown;

    try {
      await runMemoryStore("searchMemories", async () => {
        throw boom;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(boom);
    expect(errorSpy.mock.calls.length).toBeGreaterThan(0);

    const logged = errorSpy.mock.calls[0]!.join(" ");

    expect(logged).toContain("searchMemories");
    expect(logged).toContain("MEMORY_API_SECRET");

    errorSpy.mockRestore();
  });
});

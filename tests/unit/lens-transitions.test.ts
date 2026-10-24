import { describe, expect, test } from "bun:test";

import { DEFAULT_DURATION_MS, resolveDuration } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/transitions";

describe("resolveDuration", () => {
  test("idle_ready → listening is 700ms", () => {
    expect(resolveDuration("idle_ready", "listening")).toBe(700);
  });

  test("listening → ingesting is 250ms", () => {
    expect(resolveDuration("listening", "ingesting")).toBe(250);
  });

  test("reasoning → web_search uses cognitive override (200ms)", () => {
    expect(resolveDuration("reasoning", "web_search")).toBe(200);
  });

  test("searching_memory → web_search uses cognitive override (200ms)", () => {
    expect(resolveDuration("searching_memory", "web_search")).toBe(200);
  });

  test("web_search → reasoning uses cognitive override (400ms)", () => {
    expect(resolveDuration("web_search", "reasoning")).toBe(400);
  });

  test("any → writing_memory is 600ms", () => {
    expect(resolveDuration("idle_ready", "writing_memory")).toBe(600);
    expect(resolveDuration("ingesting", "writing_memory")).toBe(600);
  });

  test("writing_memory → idle_ready is 800ms", () => {
    expect(resolveDuration("writing_memory", "idle_ready")).toBe(800);
  });

  test("unlisted pair falls back to default", () => {
    expect(resolveDuration("ingesting", "reasoning")).toBe(DEFAULT_DURATION_MS);
  });
});

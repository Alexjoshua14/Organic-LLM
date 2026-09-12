import { describe, expect, test, mock } from "bun:test";

mock.module("server-only", () => ({}));

const { appendCurrentDate } = await import("@/lib/system-prompt/current-date");
const { PROMETHEUS_SYSTEM_PROMPT, SYSTEM_PROMPT } = await import("@/lib/system-prompt/prompt-v0");
const { default: SPARK_SYSTEM_PROMPT } = await import("@/lib/system-prompt");

describe("appendCurrentDate", () => {
  test("appends the timestamp as the final section", () => {
    const out = appendCurrentDate("Base prompt", new Date("2026-09-12T15:30:00.000Z"));

    expect(out).toBe(
      "Base prompt\n\nAdditional Info:\nThe current date is 2026-09-12T15:30:00.000Z"
    );
  });

  test("base prompts leave the date to the route", () => {
    for (const prompt of [SYSTEM_PROMPT, PROMETHEUS_SYSTEM_PROMPT, SPARK_SYSTEM_PROMPT]) {
      expect(prompt).not.toContain("{{currentDateTime}}");
    }
  });
});

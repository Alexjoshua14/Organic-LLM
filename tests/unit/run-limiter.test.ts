import { describe, expect, spyOn, test } from "bun:test";

import { Logger } from "@/lib/logger";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

describe("runLimiter", () => {
  test("reports timeout admission without changing the returned result", async () => {
    const warn = spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const result = { success: true, reason: "timeout", remaining: 0 };

    try {
      expect(await runLimiter("testLimiter", async () => result)).toBe(result);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[2]).toEqual({
        metric: "rate_limit.timeout_admitted",
        count: 1,
        limiter: "testLimiter",
        durationMs: expect.any(Number),
      });
    } finally {
      warn.mockRestore();
    }
  });

  test("ordinary allows, denies, and remaining queries do not report timeouts", async () => {
    const warn = spyOn(Logger.prototype, "warn").mockImplementation(() => {});

    try {
      for (const result of [{ success: true }, { success: false }, { remaining: 5 }]) {
        expect(await runLimiter("testLimiter", async () => result)).toBe(result);
      }
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test("transport failures still propagate", async () => {
    const errorLog = spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const failure = new Error("Redis unavailable");

    try {
      await expect(
        runLimiter("testLimiter", async () => {
          throw failure;
        })
      ).rejects.toBe(failure);
      expect(errorLog).toHaveBeenCalledTimes(1);
    } finally {
      errorLog.mockRestore();
    }
  });
});

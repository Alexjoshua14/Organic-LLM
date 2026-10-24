import { test, expect } from "@playwright/test";

import { signIn } from "./helpers/auth";

test.describe("Aion API (E2E)", () => {
  test("POST /api/ai/aion returns 200 (authenticated)", async ({ page }) => {
    await signIn(page);

    const result = await page.evaluate(async () => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? // @ts-ignore
            crypto.randomUUID()
          : "7b52de83-bf70-4b7b-8d9b-4a306b8b8d87";

      const res = await fetch("/api/ai/aion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          memory: false,
          message: {
            id: "e2e-user-msg-1",
            role: "user",
            parts: [{ type: "text", text: "E2E ping" }],
          },
        }),
      });

      const text = await res.text();
      return { status: res.status, text };
    });

    expect(result.status).toBe(200);
    // In AION_TEST_MODE, route uses a deterministic fake LLM output.
    expect(result.text).toContain("E2E_FAKE_LLM");
  });
});

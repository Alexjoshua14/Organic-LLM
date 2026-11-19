import { expect, test } from "@playwright/test";

import { signIn } from "./helpers/auth";

/**
 * Not a test: signs the agent test account in once and saves the session, so agents reuse it
 * instead of signing in on every run (docs/agent-test-account.md). Skipped unless asked for.
 */
export const AGENT_STORAGE_STATE_PATH = ".private/agent-storage-state.json";

test("save the agent test account's session", async ({ page }) => {
  test.skip(process.env.AGENT_SAVE_SESSION !== "1", "Set AGENT_SAVE_SESSION=1 to save a session.");

  await signIn(page);

  // Refuse to save a session for an ordinary account: it would have none of the agent limits.
  const usage = await page.request.get("/api/usage");

  expect(usage.ok()).toBe(true);
  expect(
    ((await usage.json()) as { plan?: { plan?: string } }).plan?.plan,
    "Signed in, but not as an agent account. Check AGENT_TEST_CLERK_USER_IDS on the server."
  ).toBe("agent");

  await page.context().storageState({ path: AGENT_STORAGE_STATE_PATH });
});

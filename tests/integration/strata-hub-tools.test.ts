import { describe, test, expect } from "bun:test";

import { createStrataHubAssistantTools } from "@/lib/llm/strata-assistant-tools";

/**
 * Ensures hub tools stay available for main `/api/chat` (strata_hub) and Aion.
 * Run with `bun test --preload ./tests/preload.ts` (see package.json `test` script).
 */
describe("createStrataHubAssistantTools", () => {
  test("exposes navigate and search tools", () => {
    const tools = createStrataHubAssistantTools("00000000-0000-4000-8000-000000000099");
    expect(tools.navigate_to_strata_page).toBeDefined();
    expect(tools.search_strata_pages).toBeDefined();
  });
});

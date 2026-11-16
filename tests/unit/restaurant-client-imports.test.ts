import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * The production build rejects `server-only` modules reachable from client components, but unit
 * tests do not: a client-side helper that imported `lib/llm/restaurant-tool.ts` (for the tool
 * name) pulled the Google Places client into the browser bundle and failed the Vercel build while
 * every test passed. Keep client-reachable restaurant code on the import-free constant module.
 */
const CLIENT_REACHABLE = [
  "components/chat/gen-ui/blocks/restaurant-card/group-restaurant-cards.ts",
  "components/chat/gen-ui/blocks/restaurant-card/RestaurantCarousel.tsx",
];

const SERVER_ONLY_IMPORTS = [
  "@/lib/llm/restaurant-tool",
  "@/lib/restaurant/gather-restaurant",
  "@/lib/restaurant/gather-venue",
  "@/lib/google-places/client",
];

describe("restaurant client-reachable modules", () => {
  for (const file of CLIENT_REACHABLE) {
    test(`${file} imports no server-only restaurant module`, () => {
      const source = readFileSync(file, "utf8");

      for (const specifier of SERVER_ONLY_IMPORTS) {
        expect(source).not.toContain(`"${specifier}"`);
      }
    });
  }

  test("the tool name constant has no imports, so any client can use it", () => {
    expect(readFileSync("lib/restaurant/tool-name.ts", "utf8")).not.toMatch(/^import /m);
  });
});

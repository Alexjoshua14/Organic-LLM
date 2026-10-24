import { describe, expect, test } from "bun:test";

import { threadEntryPrefetch } from "@/lib/chat/thread-entry-navigation";

describe("thread entry prefetch", () => {
  test.each([
    "/chat",
    "/sandbox/arcadia",
    "/sandbox/topic-explore",
    "/sandbox/spark",
    "/sandbox/morphChat",
    "/sandbox/prototypes/line-list",
  ])("prevents background thread creation at %s", (href) => {
    expect(threadEntryPrefetch(href)).toBe(false);
    expect(threadEntryPrefetch(`${href}/?draft=hello#composer`)).toBe(false);
  });

  test.each([
    "/chat/existing-thread",
    "/sandbox/arcadia/existing-thread",
    "/sandbox/prototypes/line-list/existing-thread",
    "/sandbox/prototypes",
    "/sandbox/prototypes/strata",
    "/rabbitholes/browse",
    "/speak",
    "/blog/surfaces/chat",
    "/chatty",
  ])("preserves default prefetch behavior at %s", (href) => {
    expect(threadEntryPrefetch(href)).toBeUndefined();
  });
});

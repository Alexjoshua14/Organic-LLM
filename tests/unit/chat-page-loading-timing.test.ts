import { describe, expect, test } from "bun:test";

import {
  CHAT_PAGE_LOADING_BREATHE_S,
  CHAT_PAGE_LOADING_ENTER_S,
  CHAT_PAGE_LOADING_EXIT_S,
} from "@/lib/chat/chat-page-loading-timing";

describe("chat page loading timing", () => {
  test("enter sits in Material short-enter band (~250–400ms)", () => {
    expect(CHAT_PAGE_LOADING_ENTER_S).toBeGreaterThanOrEqual(0.25);
    expect(CHAT_PAGE_LOADING_ENTER_S).toBeLessThanOrEqual(0.4);
  });

  test("breath sits in organic-presence idle band (2–5s)", () => {
    expect(CHAT_PAGE_LOADING_BREATHE_S).toBeGreaterThanOrEqual(2);
    expect(CHAT_PAGE_LOADING_BREATHE_S).toBeLessThanOrEqual(5);
  });

  test("exit is faster than enter", () => {
    expect(CHAT_PAGE_LOADING_EXIT_S).toBeLessThan(CHAT_PAGE_LOADING_ENTER_S);
  });
});

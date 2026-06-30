import { describe, expect, test } from "bun:test";

import {
  DEFAULT_COMPOSER_MEMORIES,
  DEFAULT_COMPOSER_MODEL,
  DEFAULT_COMPOSER_WEB_SEARCH,
} from "@/lib/chat/composer-tool-defaults";
import { AUTO_CHAT_MODEL_ID } from "@/lib/schemas/chat";

describe("composer tool defaults", () => {
  test("web search and memory are on by default", () => {
    expect(DEFAULT_COMPOSER_WEB_SEARCH).toBe(true);
    expect(DEFAULT_COMPOSER_MEMORIES).toBe(true);
  });

  test("default model is Auto for gateway routing", () => {
    expect(DEFAULT_COMPOSER_MODEL.id).toBe(AUTO_CHAT_MODEL_ID);
  });
});

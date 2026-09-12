import { describe, expect, test } from "bun:test";

import {
  RABBIT_HOLE_COMPOSER_MORPH_SPRING,
  RABBIT_HOLE_DESKTOP_CHAT_SPRING,
} from "@/lib/rabbit-holes/desktop-chat-morph-springs";

describe("desktop-chat-morph-springs", () => {
  test("exports snappy spring presets", () => {
    expect(RABBIT_HOLE_DESKTOP_CHAT_SPRING.stiffness).toBeGreaterThan(400);
    expect(RABBIT_HOLE_COMPOSER_MORPH_SPRING.damping).toBeGreaterThan(0);
  });
});

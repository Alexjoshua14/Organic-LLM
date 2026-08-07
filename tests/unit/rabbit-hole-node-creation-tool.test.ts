import { describe, expect, test } from "bun:test";

import { createRabbitHoleAssistantTools } from "@/lib/llm/rabbit-hole-assistant-tools";

describe("rabbit-hole assistant tools", () => {
  test("exports navigate, generate, and search tools", () => {
    const tools = createRabbitHoleAssistantTools({
      sessionId: "00000000-0000-4000-8000-000000000001",
      sbUserId: "user-1",
      getActiveNodeId: () => null,
    });

    expect(tools.navigate_rabbit_hole_node).toBeDefined();
    expect(tools.generate_rabbit_hole_node).toBeDefined();
    expect(tools.search_rabbit_hole_context).toBeDefined();
  });
});

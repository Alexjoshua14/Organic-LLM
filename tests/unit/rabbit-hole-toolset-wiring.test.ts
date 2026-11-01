import { describe, expect, test } from "bun:test";

import { compileChatTools } from "@/lib/llm/compile-chat-tools";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const READ_TOOLS = [
  "list_rabbit_holes",
  "search_rabbit_holes",
  "get_rabbit_hole",
  "get_rabbit_hole_node",
  "get_rabbit_hole_node_section",
];
const CREATE_TOOLS = ["create_rabbit_hole", "create_rabbit_hole_node"];

describe("rabbit hole toolset wiring", () => {
  test("Arcadia gets both categories and their guidance", async () => {
    const compiled = await compileChatTools({
      experience: "arcadia",
      useSearch: false,
      useMemory: false,
      sbUserId: "user-1",
    });
    const names = Object.keys(compiled.tools);

    for (const name of [...READ_TOOLS, ...CREATE_TOOLS]) expect(names).toContain(name);
    expect(compiled.toolInstructions).toContain("Rabbit hole library (read)");
    expect(compiled.toolInstructions).toContain("Rabbit hole creation");
  });

  test("the rabbit hole agent keeps its own tools and gains both categories", async () => {
    const compiled = await compileChatTools({
      experience: "rabbit_hole",
      rabbitHoleSessionId: SESSION_ID,
      useSearch: false,
      useMemory: false,
      sbUserId: "user-1",
    });
    const names = Object.keys(compiled.tools);

    for (const name of [
      "navigate_rabbit_hole_node",
      "generate_rabbit_hole_node",
      "search_rabbit_hole_context",
      ...READ_TOOLS,
      ...CREATE_TOOLS,
    ]) {
      expect(names).toContain(name);
    }
    expect(compiled.toolInstructions).toContain("Rabbit hole creation");
  });

  test("other experiences do not get the toolset", async () => {
    const compiled = await compileChatTools({
      experience: "delphi",
      useSearch: false,
      useMemory: false,
      sbUserId: "user-1",
    });
    const names = Object.keys(compiled.tools);

    for (const name of [...READ_TOOLS, ...CREATE_TOOLS]) expect(names).not.toContain(name);
  });
});

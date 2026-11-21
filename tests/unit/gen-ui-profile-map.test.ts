import { describe, expect, test } from "bun:test";

import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import {
  GEN_UI_BLOCK_TYPES,
  GenUIBlockSchema,
  genUIBlockToMarkdown,
  ProfileMapBlockSchema,
  deriveDependents,
  safeParseGenUIBlock,
} from "@/lib/schemas/gen-ui";
import { FIXTURE_PROFILE_MAP } from "@/lib/schemas/gen-ui/fixtures";
import { GEN_UI_TOOL_INSTRUCTIONS } from "@/lib/system-prompt/gen-ui";

describe("profile-map block", () => {
  test("is registered and listed among block types", () => {
    expect(GEN_UI_BLOCK_TYPES).toContain("profile-map");
    expect(GEN_UI_REGISTRY["profile-map"].label).toBe("Profile map");
    expect(GEN_UI_REGISTRY["profile-map"].schema).toBe(ProfileMapBlockSchema);
  });

  test("fixture passes strict parse", () => {
    const r = GenUIBlockSchema.safeParse(FIXTURE_PROFILE_MAP);

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.type).toBe("profile-map");
      expect(r.data.domains.length).toBeGreaterThanOrEqual(3);
      expect(r.data.nodes.length).toBeGreaterThanOrEqual(12);
      expect(new Set(r.data.nodes.map((n) => n.kind)).size).toBeGreaterThanOrEqual(5);
    }
  });

  test("rejects unknown domain and dependency", () => {
    expect(
      ProfileMapBlockSchema.safeParse({
        ...FIXTURE_PROFILE_MAP,
        nodes: [
          {
            id: "x",
            kind: "tool",
            title: "X",
            domain: "missing",
            complexity: 1,
            confidence: 0.5,
            dependencies: [],
          },
        ],
      }).success
    ).toBe(false);

    expect(
      ProfileMapBlockSchema.safeParse({
        ...FIXTURE_PROFILE_MAP,
        nodes: [
          {
            id: "x",
            kind: "tool",
            title: "X",
            domain: "build",
            complexity: 1,
            confidence: 0.5,
            dependencies: ["nope"],
          },
        ],
      }).success
    ).toBe(false);
  });

  test("deriveDependents inverts edges on the showcase graph", () => {
    if (FIXTURE_PROFILE_MAP.type !== "profile-map") throw new Error("fixture type");
    const dependents = deriveDependents(FIXTURE_PROFILE_MAP.nodes);

    expect(dependents.get("mem0")).toContain("organic");
    expect(dependents.get("mem0")).toContain("profiletree");
    expect(dependents.get("profiletree")).toContain("remy");
    expect(dependents.get("profiletree")).toContain("ship-profile");
    expect(dependents.get("remy")).toContain("sunday-cook");
  });

  test("toMarkdown includes domains and dependency chips", () => {
    const md = genUIBlockToMarkdown(FIXTURE_PROFILE_MAP);

    expect(md).toContain("Alex · Living Profile");
    expect(md).toContain("Building Organic");
    expect(md).toContain("ProfileTree");
    expect(md).toContain("Needs:");
    expect(md).toContain("Feeds:");
    expect(md).toContain("Living Profile");
  });

  test("safeParse accepts fixture", () => {
    expect(safeParseGenUIBlock(FIXTURE_PROFILE_MAP).ok).toBe(true);
  });

  test("tool instructions mention profile-map", () => {
    expect(GEN_UI_TOOL_INSTRUCTIONS).toContain("profile-map");
  });
});

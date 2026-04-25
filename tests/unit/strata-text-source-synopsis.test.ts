import { describe, expect, test } from "bun:test";

import { StrataTextSourceNodeSchema } from "@/lib/schemas/strata";
import { getStrataTextSourceSynopsis } from "@/lib/strata/text-sources";

function node(partial: {
  id: string;
  kind: "user_text" | "web_query" | "url" | "file" | "clipboard";
  title: string;
  body: string;
}) {
  return StrataTextSourceNodeSchema.parse({
    ...partial,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("getStrataTextSourceSynopsis", () => {
  test("returns empty for blank body", () => {
    expect(
      getStrataTextSourceSynopsis(
        node({
          id: "00000000-0000-4000-8000-000000000001",
          kind: "user_text",
          title: "A",
          body: "  \n  ",
        })
      )
    ).toBe("");
  });

  test("truncates long text with ellipsis", () => {
    const long = "x".repeat(300);
    const s = getStrataTextSourceSynopsis(
      node({
        id: "00000000-0000-4000-8000-000000000001",
        kind: "user_text",
        title: "A",
        body: long,
      }),
      50
    );
    expect(s.length).toBeLessThanOrEqual(50);
    expect(s.endsWith("…")).toBe(true);
  });

  test("strips content after Source URL footer for snippet+link bodies", () => {
    const body = "First paragraph about topic.\n\nSource URL: https://example.com/page";
    const s = getStrataTextSourceSynopsis(
      node({
        id: "00000000-0000-4000-8000-000000000001",
        kind: "web_query",
        title: "Hit",
        body,
      })
    );
    expect(s).toBe("First paragraph about topic.");
  });

  test("collapses internal whitespace", () => {
    const s = getStrataTextSourceSynopsis(
      node({
        id: "00000000-0000-4000-8000-000000000001",
        kind: "user_text",
        title: "A",
        body: "lineone\n\ntwo \t  three",
      }),
      200
    );
    expect(s).toBe("lineone two three");
  });
});

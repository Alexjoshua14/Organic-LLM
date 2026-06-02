import { describe, expect, test } from "bun:test";

import { buildShader } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/shaders/buildShader";

describe("buildShader", () => {
  test("concatenates chunks in order and includes MAIN last", () => {
    const main = "void main() { gl_Position = vec4(0.0); }";
    const out = buildShader(["// a", "// b", main]);

    expect(out.indexOf("// a")).toBeLessThan(out.indexOf("// b"));
    expect(out.endsWith(main)).toBe(true);
    expect(out).toContain("// a");
    expect(out).toContain("// b");
  });
});

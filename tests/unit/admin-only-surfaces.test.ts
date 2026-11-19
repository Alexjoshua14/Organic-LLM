import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import * as navigation from "next/navigation";
import * as labAccessModule from "@/lib/admin/lab-access";
import { mockModulePreservingReal } from "../helpers/module-mock";

let lab: { clerkUserId: string; sbUserId: string } | null = null;

// Restored in afterAll: mock.module is process-wide, and a stub left behind changes
// requireLabAccess and notFound for every later test file (file order differs on the Linux runner).
const restores = [
  mockModulePreservingReal("@/lib/admin/lab-access", labAccessModule, {
    requireLabAccess: async () => lab,
  }),
  mockModulePreservingReal("next/navigation", navigation, {
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  }),
];

afterAll(() => {
  for (const restore of restores) restore();
});

const { default: AdminOnlyLayout } = await import("@/lib/admin/admin-only-layout");

// Finished surfaces that invited (non-admin) accounts may open under /sandbox.
const OPEN_SANDBOX_SURFACES = new Set(["arcadia"]);
const GATE = /admin-only-layout|requireAdmin\(\)|requireLabAccess\(\)/;

describe("admin-only surfaces", () => {
  test("the layout 404s for everyone without lab access", async () => {
    lab = null;
    await expect(AdminOnlyLayout({ children: "lab" })).rejects.toThrow("NEXT_NOT_FOUND");
    lab = { clerkUserId: "member", sbUserId: "sb_member" };
    expect(await AdminOnlyLayout({ children: "lab" })).toBe("lab");
  });

  test("every sandbox lab except finished surfaces is gated", () => {
    const root = join(process.cwd(), "app/sandbox");
    const labs = readdirSync(root).filter(
      (name) => statSync(join(root, name)).isDirectory() && !name.startsWith("_")
    );
    const ungated = labs.filter((name) => {
      if (OPEN_SANDBOX_SURFACES.has(name)) return false;
      const file = join(root, name, "layout.tsx");

      return !existsSync(file) || !GATE.test(readFileSync(file, "utf8"));
    });

    expect(labs.length).toBeGreaterThan(5);
    expect(ungated).toEqual([]);
    expect(readFileSync(join(root, "page.tsx"), "utf8")).toMatch(GATE);
  });

  test("unfinished top-level surfaces are gated", () => {
    for (const segment of ["archetype", "introspection", "status", "stage"]) {
      expect(readFileSync(join(process.cwd(), "app", segment, "layout.tsx"), "utf8")).toMatch(GATE);
    }
  });
});

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import * as navigation from "next/navigation";
import * as requireAdminModule from "@/lib/admin/require-admin";
import { mockModulePreservingReal } from "../helpers/module-mock";

let admin: { clerkUserId: string; sbUserId: string } | null = null;

// Restored in afterAll: mock.module is process-wide, and a stub left behind changes
// requireAdmin and notFound for every later test file (file order differs on the Linux runner).
const restores = [
  mockModulePreservingReal("@/lib/admin/require-admin", requireAdminModule, {
    requireAdmin: async () => admin,
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
const GATE = /admin-only-layout|requireAdmin\(\)/;

describe("admin-only surfaces", () => {
  test("the layout 404s for everyone but admins", async () => {
    admin = null;
    await expect(AdminOnlyLayout({ children: "lab" })).rejects.toThrow("NEXT_NOT_FOUND");
    admin = { clerkUserId: "admin", sbUserId: "sb_admin" };
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

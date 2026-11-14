import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup } from "@testing-library/react";

import { render } from "../helpers/render";

import { AdminIndex } from "@/app/admin/_components/AdminIndex";
import {
  ADMIN_GROUPS,
  ADMIN_PAGES,
  adminPageForPath,
  adminPagesInGroup,
} from "@/lib/admin/admin-pages";

afterEach(cleanup);

describe("admin page registry", () => {
  test("lists exactly the page folders under app/admin", () => {
    const root = join(process.cwd(), "app/admin");
    const folders = readdirSync(root).filter(
      (name) => !name.startsWith("_") && statSync(join(root, name)).isDirectory()
    );

    expect([...folders].sort()).toEqual(ADMIN_PAGES.map((p) => p.slug).sort());
  });

  test("every entry has a unique href that matches its folder, and a group that exists", () => {
    const groups = new Set(ADMIN_GROUPS.map((g) => g.id));

    expect(new Set(ADMIN_PAGES.map((p) => p.href)).size).toBe(ADMIN_PAGES.length);
    for (const page of ADMIN_PAGES) {
      expect(page.href).toBe(`/admin/${page.slug}`);
      expect(groups.has(page.group)).toBe(true);
      expect(page.blurb.length).toBeLessThanOrEqual(90);
    }
    expect(ADMIN_GROUPS.flatMap((g) => adminPagesInGroup(g.id))).toHaveLength(ADMIN_PAGES.length);
  });

  test("finds the current page from a path, including nested paths, and not the index", () => {
    expect(adminPageForPath("/admin/performance")?.slug).toBe("performance");
    expect(adminPageForPath("/admin/invites/anything")?.slug).toBe("invites");
    expect(adminPageForPath("/admin")).toBeUndefined();
  });
});

describe("AdminIndex", () => {
  test("links every page in both the desktop and the phone layout", () => {
    const view = render(<AdminIndex />);

    for (const page of ADMIN_PAGES) {
      const links = view.getAllByRole("link", { name: new RegExp(page.title) });
      const hrefs = links.map((l) => l.getAttribute("href"));

      // One per layout; CSS shows exactly one of them.
      expect(hrefs.filter((h) => h === page.href)).toHaveLength(2);
    }
  });

  test("has a single page heading", () => {
    const view = render(<AdminIndex />);

    expect(view.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

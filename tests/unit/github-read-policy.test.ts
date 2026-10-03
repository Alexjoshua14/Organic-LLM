import { describe, expect, test } from "bun:test";

import {
  githubRepoAllowed,
  loadGithubReadSettings,
  parseGithubPath,
  parseGithubRef,
} from "@/lib/github/policy";

describe("loadGithubReadSettings", () => {
  test("requires an allowlist", () => {
    const settings = loadGithubReadSettings({});

    expect(settings.enabled).toBe(false);
    if (settings.enabled) return;
    expect(settings.code).toBe("not_configured");
  });

  test("rejects a wildcard unless the explicit flag is set", () => {
    const blocked = loadGithubReadSettings({ GITHUB_READ_ALLOWLIST: "*" });

    expect(blocked.enabled).toBe(false);

    const open = loadGithubReadSettings({
      GITHUB_READ_ALLOWLIST: "*",
      GITHUB_READ_ALLOW_ANY: "1",
      GITHUB_READ_TOKEN: "token",
    });

    expect(open.enabled).toBe(true);
    if (!open.enabled) return;
    expect(open.allowAny).toBe(true);
    expect(open.token).toBe("token");
  });

  test("rejects a mix of * and named repos", () => {
    const settings = loadGithubReadSettings({
      GITHUB_READ_ALLOWLIST: "*,acme/widgets",
      GITHUB_READ_ALLOW_ANY: "1",
    });

    expect(settings.enabled).toBe(false);
  });

  test("matches owner/repo case-insensitively and ignores other repos", () => {
    const settings = loadGithubReadSettings({
      GITHUB_READ_ALLOWLIST: "Acme/Widgets, other/repo",
    });

    expect(githubRepoAllowed(settings, "acme", "widgets")).toBe(true);
    expect(githubRepoAllowed(settings, "acme", "other")).toBe(false);
  });
});

describe("github path and ref parsing", () => {
  test("rejects traversal and empty paths", () => {
    expect(parseGithubPath("../secrets")).toBeNull();
    expect(parseGithubPath("lib/../../etc/passwd")).toBeNull();
    expect(parseGithubPath("/lib/github/policy.ts")).toBe("lib/github/policy.ts");
  });

  test("rejects refs that walk parents", () => {
    expect(parseGithubRef("feature/github")).toBe("feature/github");
    expect(parseGithubRef("..main")).toBeNull();
    expect(parseGithubRef(undefined)).toBeUndefined();
  });
});

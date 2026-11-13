import { describe, expect, test } from "bun:test";

import { classifyResource, PERF_RESOURCE_CATEGORIES } from "@/lib/perf/resource-category";

const ORIGIN = "https://app.example.test";
const UUID = "9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

describe("classifyResource", () => {
  test.each([
    [`${ORIGIN}/_next/static/media/Satoshi-Regular.woff2`, "font"],
    [`${ORIGIN}/_next/static/chunks/app/page-1a2b3c.js`, "script"],
    [`${ORIGIN}/_next/static/css/abc123.css`, "css"],
    [`${ORIGIN}/chat/${UUID}?_rsc=1x2y3`, "rsc"],
    [`${ORIGIN}/api/chat/${UUID}/stream`, "api-stream-resume"],
    [`${ORIGIN}/api/chat/${UUID}/arcadia/messages`, "api-messages"],
    [`${ORIGIN}/api/chats/activity`, "api-sidebar"],
    [`${ORIGIN}/api/usage/summary`, "api-usage"],
    [`${ORIGIN}/api/perf/ingest`, "api-other"],
    [`${ORIGIN}/_next/image?url=%2Fa.png&w=640`, "image"],
    ["https://fonts.gstatic.com/s/inter/v13/abc.woff2", "font"],
    ["https://clerk.example.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js", "clerk"],
    ["https://cdn.somewhere.test/widget.js", "third-party"],
    [`${ORIGIN}/something-else`, "other"],
  ])("%s → %s", (url, expected) => {
    expect(classifyResource(url, ORIGIN)).toBe(expected as never);
  });

  test("always returns a member of the closed list, whatever the URL", () => {
    const urls = [
      `${ORIGIN}/chat/${UUID}`,
      `${ORIGIN}/api/chat/${UUID}/messages?token=secret`,
      "not a url at all",
      "",
      `https://evil.test/${UUID}?email=a@b.c`,
      `${ORIGIN}/api/${UUID}`,
    ];

    for (const url of urls) {
      expect(PERF_RESOURCE_CATEGORIES).toContain(classifyResource(url, ORIGIN) as never);
    }
  });

  test("an id or query string in the URL never reaches the category", () => {
    for (const category of PERF_RESOURCE_CATEGORIES) {
      expect(category).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });
});

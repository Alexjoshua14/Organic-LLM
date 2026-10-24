import { describe, expect, test } from "bun:test";

import {
  getErgonLiquidChromeFromCookieValue,
  readErgonLiquidChromeFromDocumentCookie,
} from "@/lib/ergon/liquid-chrome-cookie";

describe("ergon liquid chrome cookie", () => {
  test("defaults to enabled when cookie is missing", () => {
    expect(getErgonLiquidChromeFromCookieValue(undefined)).toBe(true);
  });

  test("reads false from cookie value", () => {
    expect(getErgonLiquidChromeFromCookieValue("false")).toBe(false);
  });

  test("reads true from cookie value", () => {
    expect(getErgonLiquidChromeFromCookieValue("true")).toBe(true);
  });

  test("returns null when document cookie is absent", () => {
    expect(readErgonLiquidChromeFromDocumentCookie()).toBeNull();
  });
});

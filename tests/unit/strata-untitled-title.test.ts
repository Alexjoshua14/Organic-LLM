import { describe, expect, test } from "bun:test";

import {
  STRATA_DEFAULT_UNTITLED_TITLE,
  isUntitledStrataTitle,
} from "@/lib/schemas/strata";

describe("isUntitledStrataTitle", () => {
  test("treats default sentinel as untitled", () => {
    expect(isUntitledStrataTitle(STRATA_DEFAULT_UNTITLED_TITLE)).toBe(true);
  });

  test("treats blank and whitespace as untitled", () => {
    expect(isUntitledStrataTitle("")).toBe(true);
    expect(isUntitledStrataTitle("  ")).toBe(true);
    expect(isUntitledStrataTitle(null)).toBe(true);
    expect(isUntitledStrataTitle(undefined)).toBe(true);
  });

  test("treats any other title as titled", () => {
    expect(isUntitledStrataTitle("My doc")).toBe(false);
    expect(isUntitledStrataTitle("Untitled")).toBe(false);
  });
});

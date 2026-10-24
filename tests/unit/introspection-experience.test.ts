import { describe, expect, test } from "bun:test";

import {
  isIntrospectionExperience,
  resolveMemoryEnabledForExperience,
} from "@/lib/chat/chat-experience";

describe("introspection experience", () => {
  test("isIntrospectionExperience", () => {
    expect(isIntrospectionExperience("introspection")).toBe(true);
    expect(isIntrospectionExperience("arcadia")).toBe(false);
    expect(isIntrospectionExperience(undefined)).toBe(false);
  });

  test("resolveMemoryEnabledForExperience defaults memory on for introspection", () => {
    expect(resolveMemoryEnabledForExperience("introspection", undefined)).toBe(true);
    expect(resolveMemoryEnabledForExperience("introspection", false)).toBe(false);
    expect(resolveMemoryEnabledForExperience(undefined, undefined)).toBe(false);
    expect(resolveMemoryEnabledForExperience("arcadia", undefined)).toBe(false);
  });
});

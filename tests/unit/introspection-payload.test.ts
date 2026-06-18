import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

describe("introspection payload crypto", () => {
  const TEST_SECRET = Buffer.alloc(32, 7).toString("base64");

  beforeEach(() => {
    process.env.INTROSPECTION_ORGANIC_SHARED_SECRET = TEST_SECRET;
  });

  test("encrypts and decrypts a payload round trip", async () => {
    const mod = await import("@/lib/crypto/introspection-payload");
    const payload = mod.buildTestIntrospectionPayload({
      systemInstructions: "Guide the user through their core tension.",
      title: "Daily reflection",
      goal: "Surface one actionable insight",
    });

    const wire = mod.encryptIntrospectionPayload(payload);

    expect(mod.isIntrospectionPayloadWire(wire)).toBe(true);
    expect(mod.decryptIntrospectionPayload(wire)).toEqual(payload);
  });

  test("rejects expired payloads", async () => {
    const mod = await import("@/lib/crypto/introspection-payload");
    const payload = mod.buildTestIntrospectionPayload({
      systemInstructions: "hidden",
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    const wire = mod.encryptIntrospectionPayload(payload);

    expect(() => mod.decryptIntrospectionPayload(wire)).toThrow("expired");
  });

  test("rejects tampered ciphertext", async () => {
    const mod = await import("@/lib/crypto/introspection-payload");
    const payload = mod.buildTestIntrospectionPayload({ systemInstructions: "hidden" });
    const wire = mod.encryptIntrospectionPayload(payload);
    const tampered = wire.slice(0, -4) + "XXXX";

    expect(() => mod.decryptIntrospectionPayload(tampered)).toThrow();
  });

  test("rejects malformed wire format", async () => {
    const mod = await import("@/lib/crypto/introspection-payload");

    expect(() => mod.decryptIntrospectionPayload("not-a-payload")).toThrow("Malformed");
  });

  test("requires configured shared secret", async () => {
    delete process.env.INTROSPECTION_ORGANIC_SHARED_SECRET;
    const mod = await import("@/lib/crypto/introspection-payload");

    expect(() => mod.assertIntrospectionSecretConfigured()).toThrow("not configured");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  buildBootstrapPayloadFromContent,
  buildBootstrapPayloadFromHandoff,
} from "./build-payload";
import {
  assertIntrospectionSecretConfigured,
  decryptBootstrapPayload,
  encryptBootstrapPayload,
  isIntrospectionPayloadWire,
} from "./crypto";
import {
  IntrospectionBootstrapPayloadSchema,
  IntrospectionHandoffRequestSchema,
  OrganicHandoffContentSchema,
} from "./schemas";

const FIXTURES = join(import.meta.dir, "fixtures");
const TEST_SECRET = Buffer.alloc(32, 7).toString("base64");
const GOLDEN_IV = new Uint8Array(12).fill(1);

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as T;
}

beforeEach(() => {
  process.env.INTROSPECTION_ORGANIC_SHARED_SECRET = TEST_SECRET;
});

describe("organic-relay contract", () => {
  test("handoff fixture builds bootstrap matching golden content fields", () => {
    const handoff = IntrospectionHandoffRequestSchema.parse(loadJson("handoff-v1.json"));
    const expected = loadJson<Record<string, unknown>>("bootstrap-v1.json");
    const payload = buildBootstrapPayloadFromHandoff(handoff, {
      exp: expected.exp as number,
      nonce: expected.nonce as string,
    });

    expect(payload.title).toBe(expected.title);
    expect(payload.goal).toBe(expected.goal);
    expect(payload.systemInstructions).toBe(expected.systemInstructions);
    expect(payload.initialOverview).toBe(expected.initialOverview);
    expect(payload.steps).toEqual(expected.steps);
  });

  test("golden wire round-trip with fixed IV", () => {
    const bootstrap = IntrospectionBootstrapPayloadSchema.parse(
      loadJson("bootstrap-v1.json"),
    );
    const expectedWire = readFileSync(join(FIXTURES, "wire-v1.txt"), "utf8").trim();
    const wire = encryptBootstrapPayload(bootstrap, {
      secret: TEST_SECRET,
      iv: GOLDEN_IV,
    });

    expect(wire).toBe(expectedWire);
    expect(decryptBootstrapPayload(wire, { secret: TEST_SECRET })).toEqual(bootstrap);
  });

  test("organic handoff content fixture parses", () => {
    const content = OrganicHandoffContentSchema.parse(loadJson("organic-handoff-v1.json"));
    const payload = buildBootstrapPayloadFromContent(content, {
      exp: 2000000000,
      nonce: "golden-nonce-v1-test",
    });

    expect(payload.systemInstructions).toBe(content.systemInstructions);
  });

  test("isIntrospectionPayloadWire", () => {
    const wire = readFileSync(join(FIXTURES, "wire-v1.txt"), "utf8").trim();
    expect(isIntrospectionPayloadWire(wire)).toBe(true);
    expect(isIntrospectionPayloadWire("not-a-payload")).toBe(false);
  });

  test("rejects expired payloads", () => {
    const bootstrap = IntrospectionBootstrapPayloadSchema.parse(loadJson("bootstrap-v1.json"));
    const expired = { ...bootstrap, exp: Math.floor(Date.now() / 1000) - 10 };
    const wire = encryptBootstrapPayload(expired, { secret: TEST_SECRET, iv: GOLDEN_IV });

    expect(() => decryptBootstrapPayload(wire, { secret: TEST_SECRET })).toThrow("expired");
  });

  test("rejects tampered ciphertext", () => {
    const wire = readFileSync(join(FIXTURES, "wire-v1.txt"), "utf8").trim();
    const tampered = `${wire.slice(0, -4)}XXXX`;

    expect(() => decryptBootstrapPayload(tampered, { secret: TEST_SECRET })).toThrow();
  });

  test("rejects malformed wire format", () => {
    expect(() => decryptBootstrapPayload("not-a-payload", { secret: TEST_SECRET })).toThrow(
      "Malformed",
    );
  });

  test("requires configured shared secret", () => {
    delete process.env.INTROSPECTION_ORGANIC_SHARED_SECRET;

    expect(() => assertIntrospectionSecretConfigured()).toThrow("not configured");
  });

  test("rejects schema violations", () => {
    expect(() =>
      OrganicHandoffContentSchema.parse({
        title: "",
        goal: "x",
        systemInstructions: "x",
        initialOverview: "x",
      }),
    ).toThrow();

    expect(() =>
      IntrospectionBootstrapPayloadSchema.parse({
        v: 2,
        exp: 1,
        nonce: "short",
        systemInstructions: "x",
      }),
    ).toThrow();
  });
});

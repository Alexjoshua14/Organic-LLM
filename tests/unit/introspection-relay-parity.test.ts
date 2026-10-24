import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import { decryptBootstrapPayload } from "@/lib/organic-relay/crypto";

const FIXTURES = join(import.meta.dir, "../../lib/organic-relay/fixtures");
const TEST_SECRET = Buffer.alloc(32, 7).toString("base64");

beforeEach(() => {
  process.env.INTROSPECTION_ORGANIC_SHARED_SECRET = TEST_SECRET;
});

describe("introspection relay parity", () => {
  test("decrypts Introspection golden wire fixture", () => {
    const wire = readFileSync(join(FIXTURES, "wire-v1.txt"), "utf8").trim();
    const payload = decryptBootstrapPayload(wire, { secret: TEST_SECRET });

    expect(payload.nonce).toBe("golden-nonce-v1-test");
    expect(payload.title).toContain("patterns");
  });
});

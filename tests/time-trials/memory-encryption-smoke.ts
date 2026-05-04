/**
 * Smoke test for memory encryption (manual / local).
 * Requires MEMORY_ENCRYPTION_CURRENT_KEY (e.g. k1) and MEMORY_ENCRYPTION_KEY_K1 (base64 of >=32 random bytes).
 * Run:
 *   MEMORY_ENCRYPTION_CURRENT_KEY=k1 \
 *   MEMORY_ENCRYPTION_KEY_K1='QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=' \
 *   bun tests/time-trials/memory-encryption-smoke.ts
 * Or generate the key: openssl rand -base64 32
 */

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    return "";
  }
  return v;
}

const current = requireEnv("MEMORY_ENCRYPTION_CURRENT_KEY");
const keySuffix = current.match(/^k(\d+)$/i)?.[1]?.toUpperCase();
const keyEnv = keySuffix ? `MEMORY_ENCRYPTION_KEY_K${keySuffix}` : "";
const keyVal = keyEnv ? requireEnv(keyEnv) : "";

if (!current || !keyVal || !keySuffix) {
  console.error(
    "Set MEMORY_ENCRYPTION_CURRENT_KEY (e.g. k1) and the matching MEMORY_ENCRYPTION_KEY_K<n> (base64, >=32 decoded bytes). Example:\n" +
      "  MEMORY_ENCRYPTION_CURRENT_KEY=k1 \\\n" +
      "  MEMORY_ENCRYPTION_KEY_K1='QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=' \\\n" +
      "  bun tests/time-trials/memory-encryption-smoke.ts"
  );
  process.exit(1);
}

async function main() {
  const { encryptMemory, decryptMemory, isEncrypted, reencryptMemory, isEncryptedWithCurrentKey } =
    await import("@/lib/crypto/memory-encryption");

  const samples = [
    "hello ascii",
    "Hello 世界 mixed with emoji 🌍 and newline\nsecond line",
    "x".repeat(80_000),
  ];

  for (const plain of samples) {
    const enc = encryptMemory(plain);
    if (!isEncrypted(enc)) {
      throw new Error("isEncrypted should be true for ciphertext");
    }
    const round = decryptMemory(enc);
    if (round !== plain) {
      throw new Error("Round-trip mismatch for sample");
    }
  }

  if (isEncrypted("not encrypted")) {
    throw new Error("isEncrypted should be false for normal text");
  }

  const enc = encryptMemory("tamper-me");
  const parts = enc.split(":");
  if (parts.length !== 5) {
    throw new Error("expected v1:keyVersion:iv:tag:ct");
  }
  const ct = Buffer.from(parts[4], "base64");
  ct[0] ^= 0xff;
  const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${ct.toString("base64")}`;

  let threw = false;
  try {
    decryptMemory(tampered);
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("tampered") && !msg.includes("authentication failed")) {
      throw new Error(`Expected tampering/auth error message, got: ${msg}`);
    }
  }
  if (!threw) {
    throw new Error("decryptMemory should throw on tampered ciphertext");
  }

  const plain = "rotation-smoke";
  const first = encryptMemory(plain);
  if (!isEncryptedWithCurrentKey(first)) {
    throw new Error("isEncryptedWithCurrentKey expected true for fresh ciphertext");
  }
  const second = reencryptMemory(first);
  if (decryptMemory(second) !== plain) {
    throw new Error("reencryptMemory round-trip failed");
  }

  console.log("memory-encryption-smoke: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Generate a UUID v4 in environments where crypto.randomUUID may be missing
 * (e.g. older Safari, some mobile WebViews). Uses crypto.getRandomValues when
 * randomUUID is not available. Safe for client/browser code only.
 */
export function clientRandomUUID(): string {
  const crypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (crypto && typeof crypto.getRandomValues === "function") {
    // Fallback: RFC 4122 version 4 UUID using getRandomValues (widely supported)
    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort: valid UUID v4 shape using Math.random (only when crypto is missing)
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

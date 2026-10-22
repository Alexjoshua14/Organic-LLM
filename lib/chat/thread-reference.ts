/** Raw UUIDs and explicit markers are pointers, never proof of permission. */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const RAW = new RegExp(`^${UUID}$`, "i");
const MARKER = new RegExp(`^\\[thread:(${UUID})\\]$`, "i");

export function parseThreadPointer(value: string): string | null {
  const text = value.trim();
  if (RAW.test(text)) return text.toLowerCase();
  return MARKER.exec(text)?.[1]?.toLowerCase() ?? null;
}

export function threadReferenceMarker(id: string): string {
  const parsed = parseThreadPointer(id);
  if (!parsed) throw new Error("Invalid thread pointer");
  return `[thread:${parsed}]`;
}

export function extractThreadPointers(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(new RegExp(`\\[thread:(${UUID})\\]`, "gi")), (m) => m[1]!.toLowerCase()))].slice(0, 8);
}

export type ThreadReference = {
  id: string;
  title: string;
  essence: string;
  source: "generated" | "fallback";
};

/** Honest eight-word placeholder when generation is unavailable. */
export const THREAD_REFERENCE_FALLBACK = "Thread reference ready; open source for full context.";

export function validThreadEssence(value: string): boolean {
  return value.length <= 240 && value.trim().split(/\s+/).length === 8 && !value.includes("\n");
}

export function boundThreadContext(messages: Array<{ role: string; text: string }>) {
  let remaining = 8_000;
  return messages.slice(-6).reverse().map((message) => {
    const text = message.text.slice(0, Math.min(remaining, 2_000));
    remaining -= text.length;
    return { role: message.role, text };
  }).reverse().filter((message) => message.text.length > 0);
}

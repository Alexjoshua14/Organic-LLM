"use client";

/** PATCH the Arcadia starter key on an empty thread. */
export async function patchArcadiaStarterKey(
  threadId: string,
  arcadiaStarterKey: string | null
): Promise<{ ok: true; arcadiaStarterKey: string | null } | { ok: false; error: string }> {
  const res = await fetch("/api/chat/arcadia-starter", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, arcadiaStarterKey }),
  });

  if (!res.ok) {
    let error = "Failed to update starter";
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) error = payload.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error };
  }

  const data = (await res.json()) as { arcadiaStarterKey: string | null };
  return { ok: true, arcadiaStarterKey: data.arcadiaStarterKey };
}

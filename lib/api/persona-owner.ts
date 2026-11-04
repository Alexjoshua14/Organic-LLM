import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";

/** Clerk session → Supabase profile id, or the JSON error response persona routes return. */
export async function resolvePersonaOwner(): Promise<
  { ownerId: string; response?: never } | { ownerId?: never; response: Response }
> {
  const { userId } = await auth();

  if (!userId) return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const profile = await getSupabaseUserId(userId);

  if (profile.error || !profile.data) {
    return { response: Response.json({ error: "User not found" }, { status: 404 }) };
  }

  return { ownerId: profile.data };
}

/** Reads a JSON body, enforcing the byte cap even when Content-Length is missing or wrong. */
export async function readJsonWithLimit(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new RequestTooLargeError();
  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RequestTooLargeError();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(text);
}

export class RequestTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "RequestTooLargeError";
  }
}

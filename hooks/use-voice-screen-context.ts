"use client";

import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";

import { useEffect } from "react";

import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { screenSurfaceKey } from "@/lib/schemas/speak-screen-context";

/**
 * Tells the voice agent what this surface is, for as long as it is mounted.
 *
 * Call it from the component that owns the thing on screen — the chat page, the Strata page, the
 * rabbit-hole shell. Unmounting clears the registration, so navigating away is handled for free;
 * there is no matching "unregister" to forget.
 *
 * The body is never assembled here. This registers an *id*; the server turns it into text (see
 * `lib/speak/ambient-context.ts`) and the provider delivers it as a silent system item. That
 * keeps decryption and ownership checks server-side and keeps this hook free to run on every
 * page whether or not a call is live.
 *
 * ```tsx
 * useVoiceScreenContext(threadId ? { kind: "chat", id: threadId } : null);
 * ```
 *
 * Safe outside `VoiceSessionProvider` — it no-ops rather than throwing, so surfaces can adopt it
 * without caring where they are mounted.
 */
export function useVoiceScreenContext(surface: SpeakScreenSurface | null) {
  const session = useVoiceSessionOptional();
  const setScreenSurface = session?.setScreenSurface;

  // Identity rather than the object: callers build the descriptor inline, so a reference
  // comparison would re-register on every render.
  const key = surface ? screenSurfaceKey(surface) : null;

  useEffect(() => {
    if (!setScreenSurface) return;

    setScreenSurface(surface);

    return () => setScreenSurface(null);
  }, [key, setScreenSurface]);
}

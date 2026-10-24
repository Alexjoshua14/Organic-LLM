import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  findActiveSpeakRealtimeSession,
  isSpeakRealtimeEnabled,
} from "@/lib/rate-limit/speak-realtime";

export const maxDuration = 15;

/**
 * "Was I mid-call before this page loaded?"
 *
 * A reload destroys the browser's peer connection, but the session record in Redis outlives it.
 * `VoiceSessionProvider` asks this on mount; a hit lets it re-mint a call bound to the same
 * thread and clock instead of showing the user a dead bar or a silently dropped conversation.
 *
 * Returns the *logical* session: `startedAt` is the continuity anchor, so the live bar's elapsed
 * time keeps counting from when the user actually started talking rather than resetting.
 */
export async function GET() {
  if (!isSpeakRealtimeEnabled()) {
    return NextResponse.json({ session: null });
  }

  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ session: null });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    return NextResponse.json({ session: null });
  }

  const session = await findActiveSpeakRealtimeSession(sbUserIdResult.data);

  if (!session) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({
    session: {
      sessionId: session.sessionId,
      threadId: session.threadId,
      modalities: session.modalities,
      memoryEnabled: session.memoryEnabled === true,
      startedAt: session.continuityStartedAt ?? session.startedAt,
      expiresAt: session.expiresAt,
    },
  });
}

import type { Metadata } from "next";

import { UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

import Page from "@/components/layout/page";
import { IntrospectionChat } from "@/components/introspection/IntrospectionChat";
import { loadIntrospectionGuidedState } from "@/data/supabase/introspection";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { loadChat } from "@/lib/chat/chat-store";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { Thread } from "@/lib/schemas/chat";
import type { IntrospectionGuidedState } from "@/lib/schemas/introspection";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/introspection/[slug]/page.tsx");

const loadChatForRequest = cache(loadChat);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guided = await loadGuidedStateForThread(slug);

  return tabTitleMetadata(guided?.title ?? null, "Introspection");
}

async function loadGuidedStateForThread(
  threadId: string
): Promise<IntrospectionGuidedState | null> {
  const clerkUser = await auth();

  if (!clerkUser?.userId) return null;

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) return null;

  return loadIntrospectionGuidedState(threadId, sbUserIdResult.data);
}

export default async function IntrospectionSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ entry?: string }>;
}) {
  const { slug: chatId } = await params;
  const { entry } = await searchParams;

  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/introspection/${chatId}`)}`);
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    logger.error("IntrospectionSessionPage", "User not found in supabase");

    return (
      <Page>
        <p className="text-muted-foreground p-6 text-sm">Unable to load your profile.</p>
      </Page>
    );
  }

  const sbUserId = sbUserIdResult.data;
  const chatDataRes = await loadChatForRequest(chatId);

  if (chatDataRes.error || chatDataRes.data === null) {
    logger.error("IntrospectionSessionPage", "loadChat failed");

    return (
      <Page>
        <p className="text-muted-foreground p-6 text-sm">Session not found.</p>
      </Page>
    );
  }

  const guidedState = await loadIntrospectionGuidedState(chatId, sbUserId);

  if (!guidedState) {
    return (
      <Page>
        <p className="text-muted-foreground p-6 text-sm">
          This session is not an Introspection guided experience.
        </p>
      </Page>
    );
  }

  const chatData: { thread: Thread; messages: UIMessage[] } = chatDataRes.data;

  return (
    <Page chrome="full-bleed">
      <div className="h-full w-full">
        <IntrospectionChat
          chatData={chatData}
          initialGuidedState={guidedState}
          playEntryMorph={entry === "morph"}
        />
      </div>
    </Page>
  );
}

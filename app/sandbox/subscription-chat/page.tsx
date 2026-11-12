import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { PageContentFrame } from "@/components/layout/page-content-frame";
import { subscriptionConfig } from "@/lib/subscription-chat/policy";

import SubscriptionChat from "./subscription-chat";

export default async function SubscriptionChatPage() {
  try {
    const config = subscriptionConfig();
    const { userId } = await auth();
    if (userId !== config.ownerId || (await headers()).get("host") !== new URL(config.origin).host)
      notFound();
  } catch {
    notFound();
  }
  return (
    <LiquidChromePage className="items-stretch justify-start overflow-y-auto">
      <PageContentFrame maxWidth="3xl">
        <SubscriptionChat />
      </PageContentFrame>
    </LiquidChromePage>
  );
}

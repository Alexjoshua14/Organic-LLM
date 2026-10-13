import type { Metadata } from "next";

import { auth } from "@clerk/nextjs/server";

import { PlansPageClient } from "@/app/plans/_components/PlansPageClient";
import Page from "@/components/layout/page";
import { getPublicPlanTiers } from "@/lib/plans/plan-capacity";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Plans"),
};

// Nav link intentionally omitted until this page is public.
export default async function PlansPage() {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  const tiers = getPublicPlanTiers();

  return (
    <Page className="items-stretch justify-start overflow-hidden" transparentBackground>
      <PlansPageClient tiers={tiers} />
    </Page>
  );
}

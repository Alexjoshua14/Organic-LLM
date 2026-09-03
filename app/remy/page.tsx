import type { Metadata } from "next";

import { auth } from "@clerk/nextjs/server";

import { RemyPageClient } from "@/components/remy/RemyPageClient";
import Page from "@/components/layout/page";
import { getPrepWeekBundle, listPrepRecipes } from "@/data/supabase/prep";
import { localCalendarIso, parseRemyMode, resolveWeekStart } from "@/lib/prep";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Remy"),
};

export default async function RemyPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; mode?: string }>;
}) {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  const params = await searchParams;
  const weekStart = resolveWeekStart(params.week, localCalendarIso());
  const initialMode = parseRemyMode(params.mode);

  const [initialLibrary, initialBundle] = await Promise.all([
    listPrepRecipes(),
    getPrepWeekBundle(weekStart),
  ]);

  return (
    <Page className="items-stretch justify-start overflow-hidden" transparentBackground>
      <RemyPageClient
        initialBundle={initialBundle}
        initialLibrary={initialLibrary}
        initialMode={initialMode}
        weekStart={weekStart}
      />
    </Page>
  );
}

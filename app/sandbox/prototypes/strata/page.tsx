import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";

import { StrataBrowser } from "./_components/StrataBrowser";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { listStrataPagesCached } from "@/data/supabase/strata";
import type { StrataPage } from "@/lib/schemas/strata";
import Page from "@/components/layout/page";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Strata"),
};

export default async function StrataBrowserPage() {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return (
      <Page transparentBackground className="overflow-hidden">
        <AdaptiveLiquidChrome dimIntensity={0.45} />
        <div className="relative z-10 w-full max-w-5xl mx-auto p-6 overflow-y-auto h-full">
          <nav className="mb-8">
            <Link
              className="text-sm text-muted-foreground hover:text-foreground transition-colors select-none"
              href="/sandbox/prototypes"
            >
              ← Prototypes
            </Link>
          </nav>
          <p className="text-destructive">You need to sign in to use Strata.</p>
        </div>
      </Page>
    );
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);
  const ownerId = sbUserIdResult.data;

  if (sbUserIdResult.error || !ownerId) {
    return (
      <Page transparentBackground className="overflow-hidden">
        <AdaptiveLiquidChrome dimIntensity={0.45} />
        <div className="relative z-10 w-full max-w-5xl mx-auto p-6 overflow-y-auto h-full">
          <nav className="mb-8">
            <Link
              className="text-sm text-muted-foreground hover:text-foreground transition-colors select-none"
              href="/sandbox/prototypes"
            >
              ← Prototypes
            </Link>
          </nav>
          <p className="text-destructive">Could not resolve your profile for Strata.</p>
        </div>
      </Page>
    );
  }

  let dbAvailable = true;
  let pages: StrataPage[] = [];
  try {
    pages = await listStrataPagesCached(ownerId);
  } catch {
    dbAvailable = false;
  }

  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 w-full max-w-5xl mx-auto p-6 overflow-y-auto h-full">
        <nav className="mb-8">
          <Link
            className="text-sm text-muted-foreground hover:text-foreground transition-colors select-none"
            href="/sandbox/prototypes"
          >
            ← Prototypes
          </Link>
        </nav>
        <StrataBrowser dbAvailable={dbAvailable} pages={pages} />
      </div>
    </Page>
  );
}

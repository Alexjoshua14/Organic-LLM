import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { StrataBrowser } from "./_components/StrataBrowser";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { listStrataPagesCached } from "@/data/supabase/strata";
import type { StrataPage } from "@/lib/schemas/strata";
import Page from "@/components/layout/page";

export default async function StrataBrowserPage() {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return (
      <Page>
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
          <p className="text-destructive">You need to sign in to use Strata.</p>
        </div>
      </Page>
    );
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);
  const ownerId = sbUserIdResult.data;

  if (sbUserIdResult.error || !ownerId) {
    return (
      <Page>
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
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
    <Page>
      <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
        <nav className="mb-10">
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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

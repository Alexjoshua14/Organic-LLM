import type { Metadata } from "next";

import { cache } from "react";

import { StrataShell } from "../_components/StrataShell";

import Page from "@/components/layout/page";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { getStrataPageByIdCached } from "@/data/supabase/strata";
import { resolveStrataBrowserTabTitlePrimary } from "@/lib/metadata/resolve-browser-tab-title";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { buildStrataPageDefaults, STRATA_DEFAULT_UNTITLED_TITLE } from "@/lib/schemas/strata";

const loadStrataForRequest = cache(
  async (
    slug: string
  ): Promise<{
    pageData: Awaited<ReturnType<typeof getStrataPageByIdCached>>;
    dbAvailable: boolean;
  }> => {
    try {
      const pageData = await getStrataPageByIdCached(slug);

      return { pageData, dbAvailable: true };
    } catch {
      return { pageData: null, dbAvailable: false };
    }
  }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { pageData } = await loadStrataForRequest(slug);
  const initial = pageData ?? buildStrataPageDefaults(slug, STRATA_DEFAULT_UNTITLED_TITLE);
  const primary = await resolveStrataBrowserTabTitlePrimary(initial);

  return tabTitleMetadata(primary, "Strata");
}

export default async function StrataPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { pageData, dbAvailable } = await loadStrataForRequest(slug);

  const initialData = pageData ?? buildStrataPageDefaults(slug, STRATA_DEFAULT_UNTITLED_TITLE);

  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} dimIntensityFull={0.62} />
      <div className="relative z-10 h-full w-full">
        <StrataShell dbAvailable={dbAvailable} initialData={initialData} />
      </div>
    </Page>
  );
}

import Page from "@/components/layout/page";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { getStrataPageByIdCached } from "@/data/supabase/strata";
import { buildStrataPageDefaults } from "@/lib/schemas/strata";

import { StrataShell } from "../_components/StrataShell";

export default async function StrataPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let dbAvailable = true;
  let pageData = null;
  try {
    pageData = await getStrataPageByIdCached(slug);
  } catch {
    dbAvailable = false;
  }

  const initialData = pageData ?? buildStrataPageDefaults(slug, "Untitled Strata page");

  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} dimIntensityFull={0.62} />
      <div className="relative z-10 h-full w-full">
        <StrataShell dbAvailable={dbAvailable} initialData={initialData} />
      </div>
    </Page>
  );
}

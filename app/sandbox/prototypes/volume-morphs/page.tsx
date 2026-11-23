import { VolumeMorphLab } from "./volume-morph-lab";

import Page from "@/components/layout/page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata = tabTitleMetadata(null, "Volume morphs");

export default function VolumeMorphPage() {
  return (
    <Page>
      <VolumeMorphLab />
    </Page>
  );
}

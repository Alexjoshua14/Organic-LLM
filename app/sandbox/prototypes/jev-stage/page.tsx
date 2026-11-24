import type { Metadata } from "next";

import { JevStageLab } from "./_components/jev-stage-lab";

import Page from "@/components/layout/page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Jev Stage"),
};

export default function JevStagePrototypePage() {
  return (
    <Page chrome="full-bleed" className="!gap-0 !items-stretch !justify-start">
      <JevStageLab />
    </Page>
  );
}

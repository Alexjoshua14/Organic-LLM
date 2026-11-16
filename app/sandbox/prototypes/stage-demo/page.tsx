import type { Metadata } from "next";

import { StageDemo } from "./_components/stage-demo";

import Page from "@/components/layout/page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Stage demo"),
};

export default function StageDemoPage() {
  return (
    <Page chrome="full-bleed" className="!gap-0 !items-stretch !justify-start">
      <StageDemo />
    </Page>
  );
}

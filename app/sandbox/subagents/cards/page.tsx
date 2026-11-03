import type { Metadata } from "next";

import { SubagentCardLab } from "./_components/subagent-card-lab";

import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Subagent cards"),
};

export default function SubagentCardLabPage() {
  return (
    <Page className="items-stretch justify-start overflow-hidden">
      <div className="h-full min-h-0 w-full overflow-y-auto pb-stack-2xl">
        <PageContentFrame maxWidth="7xl">
          <PageNavBack className="mb-stack-md" href="/sandbox/subagents">
            ← Subagent lab
          </PageNavBack>
          <header className="mb-stack-lg">
            <h1 className="text-2xl font-semibold tracking-tight">Subagent cards</h1>
          </header>
          <SubagentCardLab />
        </PageContentFrame>
      </div>
    </Page>
  );
}

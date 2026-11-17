import type { Metadata } from "next";

import { GenUiLabShell } from "./_components/GenUiLabShell";

import Page from "@/components/layout/page";
import { PageContentFrame } from "@/components/layout/page-content-frame";
import { DiagramTakeoverShell } from "@/components/mermaid/diagram-takeover-shell";
import { DiagramTakeoverProvider } from "@/lib/mermaid/diagram-takeover-context";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { buildDefaultBlockMap } from "@/lib/sandbox/gen-ui-lab";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Gen UI Lab"),
};

export default function GenUiLabPage() {
  return (
    <Page className="items-stretch justify-start overflow-hidden">
      {/* The Diagram page expands into the same takeover chat uses. */}
      <DiagramTakeoverProvider>
        <div className="h-full min-h-0 w-full overflow-hidden pb-4">
          <PageContentFrame className="h-full min-h-0" maxWidth="7xl" withTopClearance>
            <GenUiLabShell initialBlocks={buildDefaultBlockMap()} />
          </PageContentFrame>
        </div>
        <DiagramTakeoverShell />
      </DiagramTakeoverProvider>
    </Page>
  );
}

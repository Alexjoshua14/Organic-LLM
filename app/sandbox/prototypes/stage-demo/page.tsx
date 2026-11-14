import type { Metadata } from "next";

import Link from "next/link";

import { StageDemo } from "./_components/stage-demo";

import Page from "@/components/layout/page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Stage demo"),
};

export default function StageDemoPage() {
  return (
    <Page chrome="full-bleed" className="!gap-0 !items-stretch !justify-start">
      <header className="shrink-0 border-b border-border/50 px-5 py-3 sm:px-8">
        <Link
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          href="/sandbox/prototypes"
        >
          &larr; Prototypes
        </Link>
      </header>
      <div className="min-h-0 flex-1">
        <StageDemo />
      </div>
    </Page>
  );
}

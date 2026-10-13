import type { Metadata } from "next";

import { ReleaseNotesClient } from "./_components/ReleaseNotesClient";

import Page from "@/components/layout/page";
import { PageTopBar } from "@/components/layout/page-top-bar";
import { ReturnButton } from "@/components/ReturnButton";

export const metadata: Metadata = {
  title: "Release notes",
  description: "What changed in Organic LLM, in plain language.",
};

export default function ReleaseNotesPage() {
  return (
    <Page>
      <PageTopBar leading={<ReturnButton />} title="Release notes" />
      <div className="flex-1 w-full overflow-y-auto scroll-smooth">
        <ReleaseNotesClient />
      </div>
    </Page>
  );
}

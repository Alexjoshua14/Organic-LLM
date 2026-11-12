import type { Metadata } from "next";

import { CodeStudies } from "./studies";

import Page from "@/components/layout/page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = tabTitleMetadata(null, "Code primitives");

export default function CodePrimitivesPage() {
  return (
    <Page className="items-stretch justify-start overflow-hidden">
      <CodeStudies />
    </Page>
  );
}

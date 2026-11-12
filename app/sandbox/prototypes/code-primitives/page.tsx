import type { Metadata } from "next";

import { CodeStudies } from "./studies";

import Page from "@/components/layout/page";
import { fontMono } from "@/config/fonts";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = tabTitleMetadata(null, "Code primitives");

export default function CodePrimitivesPage() {
  return (
    <Page className={`${fontMono.variable} items-stretch justify-start overflow-hidden`}>
      <CodeStudies />
    </Page>
  );
}

import type { Metadata } from "next";

import { LoadingPagesLab } from "./_components/loading-pages-lab";

import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = tabTitleMetadata(null, "Loading pages");

export default function LoadingPagesPrototypePage() {
  return <LoadingPagesLab />;
}

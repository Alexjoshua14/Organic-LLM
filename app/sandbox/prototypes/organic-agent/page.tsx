import type { Metadata } from "next";

import { OrganicActivityMarkLab } from "./_components/organic-activity-mark-lab";

import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Organic Agent"),
};

export default function OrganicAgentPrototypePage() {
  return <OrganicActivityMarkLab />;
}
